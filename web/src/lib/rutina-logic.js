// Puerto de las dos secciones "/* ================= RUTINA ================= */"
// de index.html, más los handlers del dispatcher ACT (ex-add/ex-edit/ex-del/
// ex-up/ex-down/day-toggle/day-del/rut-edit/rut-view/rut-edit-day/lib-*/
// tmpl-clear) que mutan S.routine/S.lib — se centralizan acá en vez de en
// Rutina.jsx porque son la misma clase de lógica de negocio que
// pushHistory/undoRutina/etc., no JSX. `renderRutina()`/`closeSheet(html)`
// del original se reemplazan por `bump()`/`openSheet(type,props)` (Task 1/5,
// ver state.js) en todos los casos.
import { S, bump, openSheet, closeSheet, saveCfg } from './state.js';
import { dstr, uid, norm, vibrate, WDS } from './format.js';
import { idb } from './db.js';
import { EXCATALOG, catOf, muscleVolume } from './muscle.js';
import { VOLUME_BANDS } from './charts.js';
import { exKey } from './equip.js';
import { toast } from './toast.js';

/* ================= RUTINA ================= */
/* insights derivados del historial de sesiones: sin esquema nuevo, se calcula
   todo de S.sessions. daySessions/sessionsSince/routineStability no las usa
   todavía Rutina.jsx (son para el sheet de "antes de entrenar" — Task 6),
   pero viven acá porque son la misma familia de lógica y ya estaban en este
   mismo bloque del original. */
/** Sesiones de un turno, por `slotId` (estable, sobrevive a reordenamientos)
    — no por weekday. Sólo encuentra sesiones nuevas (post-migración a
    secuencia): las viejas guardan `weekday`, no `slotId`, y no hay forma
    confiable de mapear un día de semana histórico a un turno actual, así
    que no se intenta — mejor no mostrar nada que mostrar algo por
    coincidencia de índice. */
export function daySessions(slotId) {
  return S.sessions.filter(s => s.slotId === slotId).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
export function sessionsSince(days) {
  const cutoff = dstr(new Date(Date.now() - days * 86400000));
  return S.sessions.filter(s => s.date >= cutoff).length;
}
/* ¿hace cuántas sesiones que el turno no cambia de ejercicios? compara contra la config actual del turno */
export function routineStability(slotId) {
  const slot = S.routine.find(s => s.id === slotId);
  const cur = new Set((slot?.exercises || []).map(e => norm(e.name)));
  if (!cur.size) return null;
  const sess = daySessions(slotId);
  if (!sess.length) return { sessions: 0, last: null };
  let stable = 0;
  for (const s of sess) {
    const names = new Set((s.entries || []).map(e => norm(e.name)));
    const same = names.size === cur.size && [...cur].every(n => names.has(n));
    if (!same) break;
    stable++;
  }
  return { sessions: stable, last: sess[0].date };
}

/* ---------- deload automático (Plan Fierro · Fase 3) ----------
   Si el volumen semanal de un grupo lleva 3+ semanas en su tope tolerable
   (MRV, ver VOLUME_BANDS en charts.js), sugerir una semana de descarga.
   Compara cada una de las últimas 3 semanas por separado (no un promedio
   de 21 días, que diluiría una sola semana mala) — las tres tienen que
   estar en o sobre MRV para que dispare. */
export function deloadSuggestion() {
  const semanas = [0, 1, 2].map(i => muscleVolume7For(i));
  const grupos = new Set(semanas.flatMap(s => Object.keys(s)));
  const excedidos = [...grupos].filter(cat => {
    const mrv = (VOLUME_BANDS[cat] || { mrv: 22 }).mrv;
    return semanas.every(s => (s[cat] || 0) >= mrv);
  });
  return excedidos;
}
/** Series por grupo en la semana que terminó hace `weeksAgo` semanas
    (0 = los últimos 7 días). muscleVolume(days) sólo sabe contar "los
    últimos N días desde hoy", así que se resta contando por diferencia. */
function muscleVolume7For(weeksAgo) {
  if (weeksAgo === 0) return muscleVolume(7);
  const wide = muscleVolume(7 * (weeksAgo + 1));
  const narrow = muscleVolume(7 * weeksAgo);
  const out = {};
  for (const cat of Object.keys(wide)) out[cat] = wide[cat] - (narrow[cat] || 0);
  return out;
}

/* ================= RUTINA ================= */
/* Dos modos: "view" contesta qué rutina estás usando y cómo es tu semana de un
   vistazo; "edit" es el editor día por día de siempre. */
export function routineStats() {
  const workouts = S.routine.filter(s => s.type === 'workout' && s.exercises?.length);
  const rest = S.routine.filter(s => s.type === 'rest');
  const ex = workouts.reduce((a, s) => a + s.exercises.length, 0);
  const sets = workouts.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
  return { workouts, workoutCount: workouts.length, restCount: rest.length, ex, sets };
}
export function routineName() { return S.cfg.routineName || (routineStats().workoutCount ? 'Rutina personalizada' : 'Sin rutina'); }
/* snapshot del split actual, sin ids: al aplicarlo se generan nuevos.

   Conserva equip/machine/illus. Antes guardaba sólo {name,sets,reps}, así que
   guardar una rutina en "Mis rutinas" y volver a cargarla te borraba el
   equipamiento de todos los ejercicios — y con él el enlace a su historial,
   que se compara por nombre+equipo+máquina (equip.js). Pasaba desapercibido
   porque cargar una rutina guardada es raro; traer ejercicios de una lo
   convirtió en el camino principal.

   `photo` queda afuera a propósito: son data-URLs y S.lib entero vive en un
   único registro de `settings`, así que meter fotos ahí lo infla sin límite. */
export function routineSnapshot() {
  return S.routine.map(s => s.type === 'rest'
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

/** Copia de un ejercicio con id NUEVO.

    El id nuevo no es cosmético: findEx(exId) (session.js) recorre todos los
    días y devuelve la primera coincidencia, así que dos días con el mismo id
    harían que guardar una serie apunte al ejercicio equivocado.

    El historial no se pierde por eso: se compara por exKey (nombre + equipo +
    máquina), no por id, así que la copia llega sabiendo tu última vez y tus
    PRs sin hacer nada. */
export function cloneExercise(ex) {
  return {
    id: uid(),
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    equip: ex.equip || undefined,
    machine: ex.machine || undefined,
    photo: ex.photo || undefined,
    illus: ex.illus || undefined,
    cat: ex.cat || undefined,
    unilateral: ex.unilateral || undefined,
  };
}

/** Los ejercicios de una fuente de copiado: un turno de la secuencia actual
    ({fromIndex}) o un turno de una rutina guardada ({libId, libIndex}). */
export function copySourceExercises(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libIndex]?.exercises || [];
  }
  return S.routine[+src?.fromIndex]?.exercises || [];
}

/** Nombre del turno de origen, para heredarlo si el destino no tiene. */
function copySourceName(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libIndex]?.name || '';
  }
  return S.routine[+src?.fromIndex]?.name || '';
}

/**
 * Lleva ejercicios de `src` al turno `toIndex`.
 *
 * `ids` identifica qué copiar dentro del origen: por `id` cuando viene de un
 * turno de la secuencia actual, y por `name` cuando viene de una rutina
 * guardada (los ejercicios de S.lib no tienen id — se generan al aplicarlos).
 *
 * `mode`:
 *   'replace' — el destino queda con exactamente lo seleccionado.
 *   'merge'   — sólo entran los que el destino no tiene ya, comparando por
 *               exKey: el mismo nombre con otro equipo NO es un repetido, es
 *               justo lo que el módulo de equipamiento existe para separar.
 */
export async function copyExercises(src, toIndex, ids, mode = 'merge') {
  const to = +toIndex;
  if (src?.libId == null && +src?.fromIndex === to) return;   // copiar sobre sí mismo
  const elegidos = copySourceExercises(src).filter(e => ids.includes(e.id ?? e.name));
  if (!elegidos.length) return;

  const destino = ensureSlot(to);
  const existentes = mode === 'replace' ? [] : (destino.exercises || []);
  const yaHay = new Set(existentes.map(exKey));
  const nuevos = elegidos
    .filter(e => mode === 'replace' || !yaHay.has(exKey(e)))
    .map(cloneExercise);

  if (!nuevos.length && mode === 'merge') { toast('Ese turno ya tiene todos esos ejercicios'); return; }

  pushHistory(
    mode === 'replace'
      ? `Turno reemplazado con ${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'}`
      : `${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'} copiado${nuevos.length === 1 ? '' : 's'}`,
  );
  destino.exercises = [...existentes, ...nuevos];
  // Un turno que todavía no tenía nombre hereda el del origen; uno que ya lo
  // tenía se lo queda — el nombre es del turno, no del contenido.
  if (!destino.name) destino.name = copySourceName(src);
  await persistSlot(to);
  bump();
}
export async function saveLib() { await idb.put('settings', { key: 'lib', value: S.lib }); }
export async function applyDays(seq, name) {
  await idb.clear('routine');
  S.routine = seq.map((s, i) => s.type === 'rest'
    ? { id: uid(), order: i, type: 'rest' }
    : {
        id: uid(), order: i, type: 'workout', name: s.name,
        // conserva equip/machine/illus: sin ellos la rutina cargada pierde el
        // enlace a su historial (ver routineSnapshot)
        exercises: s.exercises.map(e => ({
          id: uid(), name: e.name, sets: e.sets, reps: e.reps,
          equip: e.equip || undefined, machine: e.machine || undefined, illus: e.illus || undefined,
          cat: e.cat || undefined, unilateral: e.unilateral || undefined,
        })),
      });
  await persistAll();
  S.cfg.routineName = name;
  S.cfg.seqIndex = 0; S.cfg.seqIndexDate = null;
  await saveCfg();
}
/** Deja fijos en la rutina del día los ejercicios que agregaste durante una
    sesión. Se ofrece una vez, al cerrarla (SessionView): improvisar en el
    gimnasio no debería reescribir el plan solo, pero repetir a mano lo que ya
    hiciste tampoco tiene sentido.

    Salta los que el día ya tiene (por exKey), así responder que sí dos veces
    no duplica nada. */
export async function pinAddedToRoutine(slotId, added) {
  const index = S.routine.findIndex(s => s.id === slotId);
  if (index < 0) return;
  const d = ensureSlot(index);
  const yaHay = new Set((d.exercises || []).map(exKey));
  const nuevos = (added || [])
    .filter(a => !yaHay.has(exKey(a)))
    .map(a => ({
      id: uid(), name: a.name, sets: a.sets, reps: a.reps,
      equip: a.equip || undefined, machine: a.machine || undefined, unilateral: a.unilateral || undefined,
    }));
  if (!nuevos.length) { toast('Ya estaban en tu rutina'); return; }
  pushHistory(`${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'} agregado${nuevos.length === 1 ? '' : 's'} a ${d.name || 'tu rutina'}`);
  d.exercises = [...(d.exercises || []), ...nuevos];
  await persistSlot(index);
  bump();
}

/** Renombra un ejercicio de la rutina del turno. Se ofrece al corregir qué
    ejercicio fue una entrada del historial: si el nombre estaba mal en el
    plan, lo vas a volver a registrar mal. Con un botón, no automáticamente.

    Recibe el `slotId` de la sesión (estable, sobrevive a reordenamientos),
    no un índice ni un weekday — el turno se busca por id. */
export async function renameRoutineExercise(slotId, nombreViejo, { name, equip, machine, cat, unilateral }) {
  const index = S.routine.findIndex(s => s.id === slotId);
  if (index < 0) return;
  const d = S.routine[index];
  const ex = (d.exercises || []).find(e => e.name === nombreViejo);
  if (!ex) return;
  pushHistory(`"${nombreViejo}" ahora es "${name}"`);
  ex.name = name;
  ex.equip = equip || undefined;
  ex.machine = equip && machine ? machine : undefined;
  ex.cat = cat || undefined;
  ex.unilateral = unilateral || undefined;
  await persistSlot(index);
  bump();
}

/* ---------- deshacer/rehacer del editor de rutina ---------- */
let RUT_HISTORY = [], RUT_REDO = [];
export function pushHistory(msg) {
  RUT_HISTORY.push(structuredClone(S.routine));
  if (RUT_HISTORY.length > 20) RUT_HISTORY.shift();
  RUT_REDO = [];
  toast(msg, { actionLabel: 'Deshacer', onAction: undoRutina });
}
export async function undoRutina() {
  if (!RUT_HISTORY.length) return;
  RUT_REDO.push(structuredClone(S.routine));
  S.routine = RUT_HISTORY.pop();
  await persistAll();
  bump();
  toast('Deshecho', { actionLabel: 'Rehacer', onAction: redoRutina });
}
export async function redoRutina() {
  if (!RUT_REDO.length) return;
  RUT_HISTORY.push(structuredClone(S.routine));
  S.routine = RUT_REDO.pop();
  await persistAll();
  bump();
  toast('Rehecho', { actionLabel: 'Deshacer', onAction: undoRutina });
}
export function clearHistory() { RUT_HISTORY = []; RUT_REDO = []; }

export function ensureSlot(index) {
  if (!S.routine[index]) {
    // Rellena huecos intermedios con descanso si insertás más allá del final.
    for (let i = S.routine.length; i < index; i++) S.routine[i] = { id: uid(), order: i, type: 'rest' };
    S.routine[index] = { id: uid(), order: index, type: 'workout', name: '', exercises: [] };
  }
  return S.routine[index];
}
export async function persistSlot(index) { await idb.put('routine', S.routine[index]); }
export function slotIsWorkout(index) { return S.routine[index]?.type === 'workout'; }

async function persistAll() {
  await idb.clear('routine');
  await Promise.all(S.routine.map(s => idb.put('routine', s)));
}

function reindex() { S.routine.forEach((s, i) => { s.order = i; }); }

/** Mueve un turno de `fromIndex` a `toIndex` (mismo mecanismo que reordenar
    ejercicios: splice + reindex). No hay colisión que resolver — a
    diferencia del modelo viejo (7 casilleros fijos por weekday), acá
    insertar en una posición simplemente corre lo demás un lugar. */
export async function reorderSeq(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [m] = S.routine.splice(fromIndex, 1);
  S.routine.splice(toIndex, 0, m);
  reindex();
  pushHistory('Secuencia reordenada');
  await persistAll();
  bump();
}

export async function insertWorkout(atIndex) {
  S.routine.splice(atIndex, 0, { id: uid(), order: atIndex, type: 'workout', name: '', exercises: [] });
  reindex();
  pushHistory('Entrenamiento agregado');
  await persistAll();
  bump();
}

export async function insertRest(atIndex) {
  S.routine.splice(atIndex, 0, { id: uid(), order: atIndex, type: 'rest' });
  reindex();
  pushHistory('Descanso agregado');
  await persistAll();
  bump();
}

export async function removeSlot(index) {
  if (hasOpenSession(index)) { toast('Hay una sesión abierta en este turno — terminala o descartala primero'); return; }
  pushHistory('Turno eliminado');
  S.routine.splice(index, 1);
  reindex();
  // Si el turno pendiente estaba en o después del que se borró, el puntero
  // se corre para seguir apuntando al mismo contenido relativo.
  if (S.cfg.seqIndex > index) S.cfg.seqIndex--;
  else if (S.cfg.seqIndex >= S.routine.length) S.cfg.seqIndex = Math.max(0, S.routine.length - 1);
  await Promise.all([persistAll(), saveCfg()]);
  bump();
}

/** ¿Hay una sesión en curso en este turno? Comparado por `id` del turno
    (estable), no por índice: si reordenás mientras hay una sesión abierta,
    sigue detectándola correctamente. */
export function hasOpenSession(index) { return !!S.draft && S.draft.slotId === S.routine[index]?.id; }

/* ---------- descanso automático ----------
   El editor deja de manejar descansos a mano: antes había que agregar y
   quitar turnos de "Descanso" vos mismo entre los de entrenamiento, y
   reordenar la secuencia mezclando los dos tipos era confuso —a Enzo le
   pasó justo eso reorganizando Posterior A/B. Ahora el editor sólo
   muestra los turnos de ENTRENAMIENTO (qué grupos, en qué orden) y la app
   calcula sola dónde va cada descanso, con esta regla:

     · nunca más de RACHA_MAX entrenamientos seguidos sin un franco;
     · un turno que entrena pierna pide un franco después SIEMPRE, aunque
       la racha recién arranque — pierna castiga más que el resto.

   No es la única regla posible ni la ciencia del deporte definitiva —es
   un punto de partida razonable, documentado acá para poder discutirlo—.
   Si un día el descanso automático cae mal y de verdad querés entrenar,
   "Entrenar igual" (Inicio/Hoy) ya cubre ese caso sin tocar la secuencia:
   el franco calculado se queda, simplemente no lo usás esa vez. */
const RACHA_MAX = 3;

function pideDescanso(slot, racha) {
  if (racha >= RACHA_MAX) return true;
  const cats = new Set((slot.exercises || []).map(catOf).filter(Boolean));
  return cats.has('Pierna');
}

/** Reconstruye TODA la secuencia a partir del orden de turnos de
    entrenamiento dado (sus ids) — los descansos no se preservan de la
    secuencia vieja, se recalculan siempre con `pideDescanso`. El turno
    pendiente (S.cfg.seqIndex) se seguía por ID, no por posición: si el
    turno que estaba pendiente sigue existiendo, el puntero lo sigue
    adonde haya quedado. */
export async function applyWorkoutOrder(ids) {
  // El puntero NO se sigue por el id del turno pendiente: si ese turno era
  // un descanso, su id no sobrevive al recálculo (los descansos se generan
  // de nuevo cada vez, no tienen identidad propia — ver el bucle de abajo).
  // Seguirlo así lo perdía después de CUALQUIER edición y el puntero volvía
  // a 0, que es el bug de "no calcula bien la secuencia" que reportó Enzo.
  //
  // Lo que sí es estable es CUÁNTOS entrenamientos ya se completaron en
  // este ciclo — eso es lo que importa en una secuencia que avanza por
  // finalización, no por fecha. Se cuenta antes de tocar nada, y después
  // del recálculo el puntero se para en el mismo punto del ciclo.
  let workoutsAntes = 0;
  for (let i = 0; i < S.cfg.seqIndex && i < S.routine.length; i++) {
    if (S.routine[i].type === 'workout') workoutsAntes++;
  }

  const porId = new Map(S.routine.filter(s => s.type === 'workout').map(s => [s.id, s]));
  const ordenados = ids.map(id => porId.get(id)).filter(Boolean);

  const out = [];
  let racha = 0;
  ordenados.forEach((slot, i) => {
    out.push(slot);
    racha++;
    const esUltimo = i === ordenados.length - 1;
    if (!esUltimo && pideDescanso(slot, racha)) {
      out.push({ id: uid(), type: 'rest' });
      racha = 0;
    }
  });

  S.routine = out;
  reindex();

  let contados = 0;
  let nuevoIdx = Math.max(0, S.routine.length - 1);
  for (let i = 0; i < S.routine.length; i++) {
    if (contados === workoutsAntes) { nuevoIdx = i; break; }
    if (S.routine[i].type === 'workout') contados++;
  }
  S.cfg.seqIndex = nuevoIdx;

  // La tarjeta abierta en el editor se guarda como índice absoluto
  // (S.rutOpen): tras el recálculo esa posición puede corresponder a otro
  // turno, y dejarla "abierta" mostraría el ejercicio equivocado un
  // instante — el parpadeo raro que reportó Enzo. Se cierra: es mejor un
  // colapso limpio que un contenido mal atribuido.
  S.rutOpen = null;

  await Promise.all([persistAll(), saveCfg()]);
  bump();
}

/** Agrega un turno de entrenamiento nuevo al final de la secuencia de
    entrenamientos (los descansos se recalculan solos alrededor). */
export async function addWorkoutDay() {
  const nuevo = { id: uid(), type: 'workout', name: '', exercises: [] };
  S.routine.push(nuevo); // sólo para que applyWorkoutOrder lo encuentre por id
  pushHistory('Entrenamiento agregado');
  const ids = S.routine.filter(s => s.type === 'workout').map(s => s.id);
  await applyWorkoutOrder(ids);
  return nuevo;
}

/** Saca un turno de entrenamiento (por id, no por índice — la posición
    puede haber cambiado) y recalcula los descansos con lo que queda. */
export async function removeWorkoutDay(id) {
  const idx = S.routine.findIndex(s => s.id === id);
  if (idx < 0) return;
  if (hasOpenSession(idx)) { toast('Hay una sesión abierta en este turno — terminala o descartala primero'); return; }
  pushHistory('Turno eliminado');
  const ids = S.routine.filter(s => s.type === 'workout' && s.id !== id).map(s => s.id);
  await applyWorkoutOrder(ids);
}

/** Qué día de la semana le tocaría a cada turno de S.routine SI la semana
    arrancara un lunes — un vistazo, no una promesa: la secuencia real
    avanza por finalización (ver session.js), no por fecha calendario, así
    que esto puede correrse si algún día se salta. Sirve para responder
    "¿esto me deja entrenando en fin de semana?" de un vistazo al editar. */
export function weekdayProjection() {
  return S.routine.map((_, i) => WDS[(i + 1) % 7]);
}

export async function saveSlot(index, { name }) {
  const trimmed = (name || '').trim();
  // Un descanso al que le ponés nombre pasa a ser un turno de entrenamiento:
  // no tiene sentido "nombrar" un descanso, así que el nombre es la señal de
  // que dejó de serlo.
  if (S.routine[index]?.type === 'rest' && trimmed) {
    S.routine[index] = { ...S.routine[index], type: 'workout', name: trimmed, exercises: [] };
  } else {
    ensureSlot(index).name = trimmed;
  }
  await persistSlot(index);
  closeSheet();
  bump();
}

/* mapea el nombre del día (ej. "Pecho / Tríceps") a categorías del catálogo */
export function dayCategories(name) {
  const n = norm(name || '');
  const map = [['pecho', 'Pecho'], ['espalda', 'Espalda'], ['hombro', 'Hombro'], ['pierna', 'Pierna'],
    ['gluteo', 'Glúteo'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['brazo', 'Bíceps'],
    ['abs', 'Abs'], ['abdom', 'Abs'], ['core', 'Abs'], ['gemelo', 'Gemelos'], ['pantorrilla', 'Gemelos']];
  const cats = new Set();
  map.forEach(([kw, cat]) => { if (n.includes(kw)) cats.add(cat); });
  if (n.includes('brazo')) cats.add('Tríceps');
  return cats;
}
/* sugerencias: prioriza el/los grupo(s) muscular(es) del día, evita repetir lo ya agregado */
export function recommendedExercises(wd) {
  const d = S.routine[wd];
  const existing = new Set((d?.exercises || []).map(e => norm(e.name)));
  const cats = dayCategories(d?.name);
  const pool = cats.size ? EXCATALOG.filter(e => cats.has(e.c)) : EXCATALOG.filter(e => ['Pecho', 'Espalda', 'Pierna', 'Hombro'].includes(e.c));
  return pool.filter(e => !existing.has(norm(e.n))).slice(0, 8);
}

/** Guarda una rutina armada con el asistente de grupos musculares
    (RoutineWizard.jsx) directo en la biblioteca (S.lib) — NUNCA toca
    S.routine ni S.cfg.routineName. "Armar con asistente" es para probar una
    rutina nueva sin arriesgar la que ya estás usando: pedirle a la persona
    que confirme vaciar su split actual para poder armar una de prueba no
    tiene sentido, así que este camino ni siquiera pasa cerca de esa lógica
    (esa sigue viviendo en startBlank(), para cuando de verdad se quiere
    reemplazar el split en uso).

    `days` es un array de {name, exercises:[{name,cat}]} — mismo formato que
    routineSnapshot()/applyDays(), así que una vez guardada se aplica igual
    que cualquier otra rutina de la biblioteca (applyLibRoutine ya pregunta
    ahí si querés reemplazar tu split, que es el único momento en que
    reemplazar tiene sentido). */
export function saveWizardRoutine(name, days) {
  name = (name || '').trim();
  if (!name) { toast('Ingresá un nombre'); return false; }
  if (!days?.length) { toast('Agregá al menos un día'); return false; }
  const snapshot = days.map(d => ({
    type: 'workout',
    name: d.name || '',
    exercises: (d.exercises || []).map(e => ({ name: e.name, sets: 4, reps: 10, cat: e.cat || undefined })),
  }));
  const prev = S.lib.find(r => norm(r.name) === norm(name));
  const doSave = async () => {
    if (prev) { prev.days = snapshot; prev.savedAt = dstr(); }
    else S.lib.unshift({ id: uid(), name, days: snapshot, savedAt: dstr() });
    await saveLib();
    closeSheet(); bump(); vibrate(15);
    toast(`"${name}" guardada en tu biblioteca`);
  };
  if (prev) {
    openSheet('confirm', {
      title: `¿Reemplazar "${prev.name}"?`,
      body: 'Ya tenés una rutina guardada con este nombre en tu biblioteca. Tu split activo no se toca en ningún caso.',
      confirmLabel: 'Reemplazar',
      onConfirm: doSave,
    });
  } else {
    doSave();
  }
  return true;
}

/* ---------- acciones del editor (antes handlers sueltos del ACT{} global) ---------- */
export function enterEditMode() { S.rutMode = 'edit'; bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function exitEditMode() { S.rutMode = 'view'; clearHistory(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function editSlot(index) { S.rutMode = 'edit'; S.rutOpen = index; closeSheet(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function toggleSlotOpen(index) { S.rutOpen = S.rutOpen === index ? null : index; bump(); }

/** Firma adaptada: el original leía $('#f-exname').value etc. directo del DOM
    (ACT['ex-save']->saveExercise); acá ExerciseForm.jsx mantiene esos campos
    como estado de componente y los pasa explícitos. */
export async function saveExercise(index, exId, { name, sets, reps, equip, machine, photo, illus, cat, unilateral }) {
  name = (name || '').trim();
  const s = Math.max(1, parseInt(sets) || 4);
  const r = Math.max(1, parseInt(reps) || 10);
  if (!name) { toast('Ponle nombre al ejercicio'); return; }
  const d = ensureSlot(index);
  if (exId) {
    const ex = d.exercises.find(e => e.id === exId);
    if (ex) {
      ex.name = name; ex.sets = s; ex.reps = r;
      // Sin equipo elegido se borran los campos: un ejercicio sin equipo vuelve
      // a compararse sólo por nombre, que es el comportamiento de siempre.
      ex.equip = equip || undefined;
      ex.machine = equip && machine ? machine.trim() : undefined;
      ex.photo = equip && photo ? photo : undefined;
      ex.illus = illus || undefined;
      // vacío = volver al automático de catOf(), no "sin grupo"
      ex.cat = cat || undefined;
      ex.unilateral = unilateral || undefined;
    }
  } else {
    d.exercises.push({
      id: uid(), name, sets: s, reps: r,
      equip: equip || undefined,
      machine: equip && machine ? machine.trim() : undefined,
      photo: equip && photo ? photo : undefined,
      illus: illus || undefined,
      cat: cat || undefined,
      unilateral: unilateral || undefined,
    });
  }
  await persistSlot(index);
  closeSheet(); bump(); toast('Guardado');
}

export async function deleteExercise(index, exId) {
  const d = S.routine[index];
  const ex = d.exercises.find(e => e.id === exId);
  if (!ex) return;
  pushHistory(`"${ex.name}" eliminado`);
  d.exercises = d.exercises.filter(e => e.id !== exId);
  await persistSlot(index);
  bump();
}

/** Sube/baja un ejercicio con las flechas ↑↓ (distinto del drag: acá no hay
    gesto, así que el original anima con flipSort). Deliberadamente NO llama
    bump() acá adentro — igual que el original no llama renderRutina() hasta
    después de `await persistSlot`: el llamador (Rutina.jsx) envuelve esta
    función en flipSort(), que necesita medir el DOM ANTES de que la mutación
    se refleje en pantalla. Ver Rutina.jsx: handleMoveEx(). */
export async function moveEx(index, exId, dir) {
  const d = S.routine[index];
  const i = d.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.exercises.length) return;
  pushHistory('Ejercicios reordenados');
  [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
  await persistSlot(index);
}

export function startBlank() {
  if (!S.routine.some(d => d.exercises?.length)) {
    S.rutMode = 'edit'; closeSheet(); bump(); return;
  }
  openSheet('confirm', {
    title: '¿Vaciar tu split?',
    body: 'Se borran todos los días y ejercicios.',
    confirmLabel: 'Vaciar',
    onConfirm: async () => {
      await idb.clear('routine'); S.routine = [];
      S.cfg.routineName = ''; await saveCfg();
      S.rutMode = 'edit'; closeSheet(); bump();
      toast('Split vacío — armá el tuyo');
    },
  });
}

/* ---------- "mis rutinas" (biblioteca) ---------- */
export function applyLibRoutine(id) {
  const r = S.lib.find(x => x.id === id); if (!r) return;
  openSheet('confirm', {
    title: '¿Reemplazar tu split?',
    body: `Esto reemplaza tu split actual por "${r.name}". Tu historial de sesiones no se toca.`,
    confirmLabel: 'Reemplazar',
    onConfirm: async () => {
      await applyDays(r.days, r.name);
      // S.routine siempre queda con al menos un turno acá: r.days viene de
      // routineSnapshot(), que sólo se llama sobre una S.routine ya no vacía
      // (saveCurrentAsLib no ofrece guardar un split sin turnos — ver
      // Library.jsx, "Guardar la actual como…" sólo aparece con turnos).
      S.rutMode = 'view'; S.rutOpen = 0;
      closeSheet(); bump(); vibrate([20, 40, 20]);
      toast(`"${r.name}" en uso`);
    },
    onCancel: () => openSheet('library'),
  });
}
export function deleteLibRoutine(id) {
  const r = S.lib.find(x => x.id === id); if (!r) return;
  openSheet('confirm', {
    title: `¿Borrar "${r.name}"?`,
    body: 'Tu split actual no cambia — solo se borra de tu biblioteca.',
    confirmLabel: 'Borrar',
    onConfirm: async () => {
      S.lib = S.lib.filter(x => x.id !== r.id);
      await saveLib();
      openSheet('library');
    },
    onCancel: () => openSheet('library'),
  });
}
export function saveCurrentAsLib(name) {
  name = (name || '').trim();
  if (!name) { toast('Ingresá un nombre'); return; }
  const days = routineSnapshot();
  const prev = S.lib.find(r => norm(r.name) === norm(name));
  const doSave = async () => {
    if (prev) { prev.days = days; prev.savedAt = dstr(); }
    else S.lib.unshift({ id: uid(), name, days, savedAt: dstr() });
    S.cfg.routineName = name;
    await saveLib(); await saveCfg();
    clearHistory();
    closeSheet(); bump(); vibrate(15);
    toast(`Guardada como "${name}"`);
  };
  if (prev) {
    openSheet('confirm', {
      title: `¿Reemplazar "${prev.name}"?`,
      body: 'Ya tenés una rutina guardada con este nombre.',
      confirmLabel: 'Reemplazar',
      onConfirm: doSave,
      onCancel: () => openSheet('library', { mode: 'save', name }),
    });
  } else {
    doSave();
  }
}
