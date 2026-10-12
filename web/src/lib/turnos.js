// Turnos universales (Fase 1, spec 2026-10-12-turnos-universales-y-fuera-de-plan).
//
// Un turno ("Posterior") existe UNA vez. La semana (A · P · R · A · P · R · R)
// sólo lo nombra: la secuencia sigue siendo de slots en S.routine (con sus
// ids, así que seqIndex, S.draft.slotId y las sesiones viejas siguen
// valiendo), y cada slot de entrenamiento apunta a su turno por `turnoId`.
//
// Dónde vive cada cosa:
//   - settings.turnos = [{ id, name, exercises, creado }]  (S.turnos en memoria)
//   - cada fila de `routine` = { id, order, type, turnoId, turnoFirma, name, exercises }
//     `name` y `exercises` son una COPIA del turno, reescrita cada vez que el
//     turno se guarda: es lo que lee una versión vieja de la app, que sigue
//     viendo una rutina completa. `turnoFirma` es un hash de esa copia al
//     escribirla: si no coincide, otra versión editó la fila.
//
// Este módulo no importa state.js (recibe el estado): state.js lo usa en
// loadAll y rutina-logic.js en cada guardado, sin ciclos de imports.
import { idb } from './db.js';
import { norm, uid, fmtD, dstr } from './format.js';

/* ------------------------------------------------------------------ puro */

/** Nombre para agrupar: sin tildes, en minúsculas y sin espacios de más.
    `norm` (format.ts) no colapsa los espacios internos: "Posterior  B" y
    "Posterior B" son el mismo turno. */
export const claveNombre = n => norm(n).replace(/\s+/g, ' ');

/** JSON canónico: claves ordenadas y sin `undefined`, para que dos copias
    iguales den la misma firma aunque sus claves estén en otro orden. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(x => canon(x === undefined ? null : x)).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** Firma corta de { name, exercises } SIN los id de los ejercicios:
    applyDays le da ids nuevos a cada copia, así que dos copias de la
    plantilla tienen ids distintos y el mismo contenido. Si los ids
    contaran, toda rutina armada con la plantilla daría "versiones
    distintas", con respaldo y aviso falsos. FNV-1a de 32 bits + largo. */
export function firma(x) {
  const s = canon({
    name: x?.name || '',
    exercises: (x?.exercises || []).map(e => { if (!e || typeof e !== 'object') return e; const { id: _id, ...resto } = e; return resto; }),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${s.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

/** La clave de turno de un slot: su turnoId o, en el modo viejo (sin
    turnos), su propio id — cada slot es su propio turno, como antes. */
export const claveTurno = slot => slot?.turnoId || slot?.id || null;

/** La clave de turno de una sesión: la que guardó (`turnoId`, sesiones
    nuevas) o la de su slot (sesiones de antes de los turnos: los slots
    conservan su id, así que siguen encontrándolo). */
export function claveDeSesion(s, rutina) {
  if (s?.turnoId) return s.turnoId;
  const slot = s?.slotId ? (rutina || []).find(x => x.id === s.slotId) : null;
  return claveTurno(slot) || s?.slotId || null;
}

/** La secuencia tal como está, sin ids y sin fotos — el formato de S.lib
    (`days`). Ver routineSnapshot (rutina-logic.js): las fotos quedan afuera
    a propósito porque S.lib entero vive en un solo registro. */
export function snapshotDeFilas(filas) {
  return (filas || []).map(s => s.type === 'rest'
    ? { type: 'rest' }
    : {
        type: 'workout',
        name: s.name || '',
        exercises: (s.exercises || []).map(e => ({
          name: e.name, sets: e.sets, reps: e.reps,
          equip: e.equip, machine: e.machine, illus: e.illus, cat: e.cat, unilateral: e.unilateral,
        })),
      });
}

const esEntreno = f => f?.type === 'workout';

/** ¿La fila está en orden? Apunta a un turno guardado, su copia es igual a
    ese turno, y su firma (si tiene) es la de su copia. Comparar contra el
    turno guardado además de la firma cubre a una versión vieja que importó
    un backup nuevo: filas coherentes consigo mismas pero no con los turnos. */
function consistente(f, porId) {
  const t = f.turnoId && porId.get(f.turnoId);
  if (!t) return false;
  const fc = firma(f);
  return fc === firma(t) && (f.turnoFirma == null || f.turnoFirma === fc);
}

/** Los ids de slot de las filas de entrenamiento que NO están en orden. */
export function filasInconsistentes(filas, guardados) {
  const porId = new Map((guardados || []).map(t => [t.id, t]));
  return new Set((filas || []).filter(f => esEntreno(f) && !consistente(f, porId)).map(f => f.id));
}

/**
 * Qué hay que escribir para que cada nombre sea un solo turno. Puro.
 * Devuelve null si no hace falta nada (todas las filas en orden): por eso
 * puede correr en cada arranque.
 *
 * Reglas (spec §2):
 *  - fila con turnoId válido → su turno, aunque la hayan editado: su
 *    identidad ya está decidida, no se reagrupa por nombre;
 *  - sin nombre → nunca se agrupa;
 *  - con nombre → por claveNombre ("Anterior A" ≠ "Anterior B"); si ya hay
 *    un turno con filas que se llama igual, se suma a ése;
 *  - gana la primera fila EDITADA por otra versión (la edición más nueva);
 *    si no hay, la primera en orden (el contenido establecido del turno);
 *  - un turno guardado que ya no nombra ninguna fila se conserva.
 */
export function planReconciliacion({ filas, guardados, hoy }) {
  const orden = [...(filas || [])].sort((a, b) => a.order - b.order);
  const turnosGuardados = Array.isArray(guardados) ? guardados : [];
  const porId = new Map(turnosGuardados.map(t => [t.id, t]));
  const malas = filasInconsistentes(orden, turnosGuardados);
  if (!malas.size) return null;

  const grupos = new Map();     // clave → { filas: [], guardado }
  const porNombre = new Map();  // claveNombre → clave de grupo
  const meter = (k, f, guardado = null) => {
    if (!grupos.has(k)) grupos.set(k, { filas: [], guardado });
    grupos.get(k).filas.push(f);
  };
  // 1) las que ya tienen turno (válido)
  for (const f of orden) {
    if (!esEntreno(f) || !porId.has(f.turnoId)) continue;
    const k = `id:${f.turnoId}`;
    meter(k, f, porId.get(f.turnoId));
    const cn = claveNombre(porId.get(f.turnoId).name);
    if (cn && !porNombre.has(cn)) porNombre.set(cn, k);
  }
  // 2) las que no: por nombre, o solas si no tienen
  for (const f of orden) {
    if (!esEntreno(f) || porId.has(f.turnoId)) continue;
    const cn = claveNombre(f.name);
    if (!cn) { meter(`slot:${f.id}`, f); continue; }
    if (!porNombre.has(cn)) porNombre.set(cn, `nombre:${cn}`);
    meter(porNombre.get(cn), f);
  }

  const usados = new Set(turnosGuardados.map(t => t.id));
  const resultado = new Map();   // id de turno → turno nuevo
  const turnoDeFila = new Map(); // id de slot → turno
  const distintas = [];
  for (const g of grupos.values()) {
    const editadas = g.filas.filter(f => porId.has(f.turnoId) && malas.has(f.id));
    const enOrden = g.filas.filter(f => !malas.has(f.id));
    const ganadora = editadas[0] || enOrden[0] || g.filas[0];
    let id = g.guardado?.id;
    if (!id) {
      id = ganadora.turnoId && !usados.has(ganadora.turnoId) ? ganadora.turnoId : uid();
      while (usados.has(id)) id = uid();
    }
    usados.add(id);
    const turno = {
      id,
      name: ganadora.name || '',
      exercises: structuredClone(ganadora.exercises || []),
      creado: g.guardado?.creado || hoy,
    };
    resultado.set(id, turno);
    g.filas.forEach(f => turnoDeFila.set(f.id, turno));

    const fg = firma(ganadora);
    const otras = new Set(g.filas.filter(f => firma(f) !== fg).map(firma));
    if (otras.size) distintas.push({ nombre: turno.name || 'Sin nombre', versiones: otras.size + 1, gano: editadas.length ? 'editada' : 'primera' });
  }

  // Los guardados en su orden (con el contenido nuevo si cambió, o tal cual
  // si quedaron huérfanos), y después los nuevos en el orden de la semana.
  const turnos = turnosGuardados.map(t => resultado.get(t.id) || t);
  for (const t of resultado.values()) if (!porId.has(t.id)) turnos.push(t);

  const nuevas = orden.map(f => {
    if (!esEntreno(f)) return f;
    const t = turnoDeFila.get(f.id);
    return { ...f, turnoId: t.id, turnoFirma: firma(t), name: t.name, exercises: t.exercises };
  });
  return { turnos, filas: nuevas, distintas };
}

/* ------------------------------------------------------- hidratación */

/* En memoria, cada slot de entrenamiento VINCULADO tiene `name` y `exercises`
   como propiedades de acceso (get/set, enumerables) que leen y escriben su
   turno. Así:
     - los ~40 lectores de slot.exercises / slot.name no cambian;
     - `slot.exercises = lista` (las seis reasignaciones del editor) cae en el
       turno, y `ex.sets = 2` muta el objeto compartido;
     - structuredClone, JSON y {...slot} llaman a los getters: los clones, el
       backup y el historial salen con datos planos.
   Trampa: un {...slot} es un objeto PLANO; nunca guardarlo como slot ni
   volver a meterlo en S.routine sin pasar por hidratar(). */
const VINCULOS = new WeakMap();   // slot → turno

export function vincular(slot, turno) {
  delete slot.turnoFirma;   // la firma se calcula al escribir (filaDe)
  Object.defineProperty(slot, 'name', {
    enumerable: true, configurable: true,
    get() { return turno.name; },
    set(v) { turno.name = v; },
  });
  Object.defineProperty(slot, 'exercises', {
    enumerable: true, configurable: true,
    get() { return turno.exercises; },
    set(v) { turno.exercises = v; },
  });
  slot.turnoId = turno.id;
  VINCULOS.set(slot, turno);
}

export const esVinculado = slot => !!slot && VINCULOS.has(slot);
export const turnoVinculado = slot => (slot && VINCULOS.get(slot)) || null;

/**
 * Vincula cada slot de entrenamiento con su turno. Se llama después de
 * cualquier `S.routine = …` o `S.turnos = …` (loadAll, deshacer, applyDays,
 * applyWorkoutOrder, persistAll).
 *  - `st.turnos === null` (modo viejo: migración postergada o fallida): no
 *    toca nada; cada slot sigue siendo su propia copia, como antes.
 *  - los ids de `st.turnosSinVincular` quedan planos: son filas editadas por
 *    otra versión mientras había un borrador abierto, que se reconcilian en
 *    el próximo arranque (ver reconciliarTurnos).
 *  - un slot de entrenamiento sin turno (recién creado por el editor) recibe
 *    uno nuevo con su contenido.
 */
export function hidratar(st, hoy = null) {
  if (!Array.isArray(st.turnos)) return;
  const quietas = new Set(st.turnosSinVincular || []);
  const porId = new Map(st.turnos.map(t => [t.id, t]));
  for (const slot of st.routine || []) {
    if (slot?.type !== 'workout' || quietas.has(slot.id)) continue;
    let t = slot.turnoId && porId.get(slot.turnoId);
    if (!t) {
      t = {
        id: slot.turnoId && !porId.has(slot.turnoId) ? slot.turnoId : uid(),
        name: slot.name || '',
        exercises: slot.exercises || [],
        creado: hoy || dstr(),
      };
      st.turnos.push(t);
      porId.set(t.id, t);
    }
    if (VINCULOS.get(slot) !== t) vincular(slot, t);
  }
}

/** La fila que se guarda en `routine`: la copia completa del turno con su
    firma. Un slot sin vincular (descanso, modo viejo) sale tal cual. */
export function filaDe(slot) {
  if (!esVinculado(slot)) return slot;
  const fila = { ...slot };
  fila.turnoFirma = firma(fila);
  return fila;
}

/** El nombre de la rutina de respaldo en "Mis rutinas". */
export const nombreRespaldo = hoy => `Respaldo antes de unificar turnos (${fmtD(hoy)})`;
