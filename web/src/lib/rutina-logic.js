// Puerto de las dos secciones "/* ================= RUTINA ================= */"
// de index.html, más los handlers del dispatcher ACT (ex-add/ex-edit/ex-del/
// ex-up/ex-down/day-toggle/day-del/rut-edit/rut-view/rut-edit-day/lib-*/
// tmpl-clear) que mutan S.routine/S.lib — se centralizan acá en vez de en
// Rutina.jsx porque son la misma clase de lógica de negocio que
// pushHistory/undoRutina/etc., no JSX. `renderRutina()`/`closeSheet(html)`
// del original se reemplazan por `bump()`/`openSheet(type,props)` (Task 1/5,
// ver state.js) en todos los casos.
import { S, bump, openSheet, closeSheet, saveCfg } from './state.js';
import { dstr, uid, norm, vibrate, WD, WEEK_ORDER } from './format.js';
import { idb } from './db.js';
import { EXCATALOG } from './muscle.js';
import { exKey } from './equip.js';
import { toast } from './toast.js';

/* ================= RUTINA ================= */
/* insights derivados del historial de sesiones: sin esquema nuevo, se calcula
   todo de S.sessions. daySessions/sessionsSince/routineStability no las usa
   todavía Rutina.jsx (son para el sheet de "antes de entrenar" — Task 6),
   pero viven acá porque son la misma familia de lógica y ya estaban en este
   mismo bloque del original. */
export function daySessions(wd) {
  return S.sessions.filter(s => s.weekday === wd).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
export function sessionsSince(days) {
  const cutoff = dstr(new Date(Date.now() - days * 86400000));
  return S.sessions.filter(s => s.date >= cutoff).length;
}
/* ¿hace cuántas sesiones que el día no cambia de ejercicios? compara contra la config actual del día */
export function routineStability(wd) {
  const cur = new Set((S.routine[wd]?.exercises || []).map(e => norm(e.name)));
  if (!cur.size) return null;
  const sess = daySessions(wd);
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

/* ================= RUTINA ================= */
/* Dos modos: "view" contesta qué rutina estás usando y cómo es tu semana de un
   vistazo; "edit" es el editor día por día de siempre. */
export function routineStats() {
  const days = WEEK_ORDER.filter(wd => S.routine[wd]?.exercises?.length);
  const rest = WEEK_ORDER.filter(wd => !S.routine[wd]?.exercises?.length);
  const ex = days.reduce((a, wd) => a + S.routine[wd].exercises.length, 0);
  const sets = days.reduce((a, wd) => a + S.routine[wd].exercises.reduce((b, e) => b + e.sets, 0), 0);
  return { days, rest, ex, sets };
}
export function routineName() { return S.cfg.routineName || (routineStats().days.length ? 'Rutina personalizada' : 'Sin rutina'); }
export function activeDayWds() {
  return WEEK_ORDER.filter(wd => S.routine[wd]?.name || S.routine[wd]?.exercises?.length);
}
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
  const days = {};
  WEEK_ORDER.forEach(wd => {
    const d = S.routine[wd];
    if (!d?.exercises?.length) return;
    days[wd] = {
      name: d.name || WD[wd],
      exercises: d.exercises.map(e => ({
        name: e.name, sets: e.sets, reps: e.reps,
        equip: e.equip, machine: e.machine, illus: e.illus, cat: e.cat,
      })),
    };
  });
  return days;
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
  };
}

/** Los ejercicios de una fuente de copiado: un día de la semana
    ({fromWd}) o un día de una rutina guardada ({libId, libWd}). */
export function copySourceExercises(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libWd]?.exercises || [];
  }
  return S.routine[+src?.fromWd]?.exercises || [];
}

/** Nombre del día de origen, para heredarlo si el destino no tiene. */
function copySourceName(src) {
  if (src?.libId != null) {
    const r = S.lib.find(x => x.id === src.libId);
    return r?.days?.[src.libWd]?.name || '';
  }
  return S.routine[+src?.fromWd]?.name || '';
}

/**
 * Lleva ejercicios de `src` al día `toWd`.
 *
 * `ids` identifica qué copiar dentro del origen: por `id` cuando viene de un
 * día de la semana, y por `name` cuando viene de una rutina guardada (los
 * ejercicios de S.lib no tienen id — se generan al aplicarlos).
 *
 * `mode`:
 *   'replace' — el destino queda con exactamente lo seleccionado.
 *   'merge'   — sólo entran los que el destino no tiene ya, comparando por
 *               exKey: el mismo nombre con otro equipo NO es un repetido, es
 *               justo lo que el módulo de equipamiento existe para separar.
 */
export async function copyExercises(src, toWd, ids, mode = 'merge') {
  const to = +toWd;
  if (src?.libId == null && +src?.fromWd === to) return;   // copiar sobre sí mismo
  const elegidos = copySourceExercises(src).filter(e => ids.includes(e.id ?? e.name));
  if (!elegidos.length) return;

  const destino = ensureDay(to);
  const existentes = mode === 'replace' ? [] : (destino.exercises || []);
  const yaHay = new Set(existentes.map(exKey));
  const nuevos = elegidos
    .filter(e => mode === 'replace' || !yaHay.has(exKey(e)))
    .map(cloneExercise);

  if (!nuevos.length && mode === 'merge') { toast('Ese día ya tiene todos esos ejercicios'); return; }

  pushHistory(
    mode === 'replace'
      ? `${WD[to]} reemplazado con ${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'}`
      : `${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'} copiado${nuevos.length === 1 ? '' : 's'} al ${WD[to].toLowerCase()}`,
  );
  destino.exercises = [...existentes, ...nuevos];
  // Un día que todavía no tenía nombre hereda el del origen; uno que ya lo
  // tenía se lo queda — el nombre es del día, no del contenido.
  if (!destino.name) destino.name = copySourceName(src);
  await persistDay(to);
  bump();
}
export async function saveLib() { await idb.put('settings', { key: 'lib', value: S.lib }); }
export async function applyDays(days, name) {
  await idb.clear('routine');
  S.routine = {};
  for (const wd in days) {
    S.routine[wd] = {
      weekday: +wd, name: days[wd].name,
      // conserva equip/machine/illus: sin ellos la rutina cargada pierde el
      // enlace a su historial (ver routineSnapshot)
      exercises: days[wd].exercises.map(e => ({
        id: uid(), name: e.name, sets: e.sets, reps: e.reps,
        equip: e.equip || undefined, machine: e.machine || undefined, illus: e.illus || undefined,
        cat: e.cat || undefined,
      })),
    };
    await persistDay(+wd);
  }
  S.cfg.routineName = name;
  await saveCfg();
}
/** ¿Hay una sesión en curso en este día? Mover un día con la sesión abierta le
    cambiaría los ejercicios por debajo: orderedExs() (session.js) los resuelve
    leyendo S.routine[draft.weekday] en cada render, así que el editor lo
    bloquea en vez de dejar la sesión apuntando a otra cosa. */
export function hasOpenSession(wd) { return !!S.draft && S.draft.weekday === +wd; }

/** Mueve un día entero — nombre y ejercicios — a otro día de la semana. Si el
    destino ya tenía entrenamiento, los dos se intercambian: no hay caso en que
    algo se pise o se pierda.

    El historial no entra acá a propósito: cada sesión guarda su propio
    `weekday`, que es el día en que realmente entrenaste. Mover el plan cambia
    de acá en adelante; reescribir las sesiones sería falsear el registro. */
export async function moveDayTo(fromWd, toWd) {
  const from = +fromWd, to = +toWd;
  if (from === to) return;
  const a = S.routine[from] || { weekday: from, name: '', exercises: [] };
  const b = S.routine[to] || { weekday: to, name: '', exercises: [] };
  // weekday es el keyPath del store: corregirlo es lo que hace que cada uno se
  // guarde en su registro nuevo en vez de sobrescribir el viejo.
  S.routine[to] = { ...a, weekday: to };
  S.routine[from] = { ...b, weekday: from };
  // El orden reacomodado en Hoy es por día, así que viaja con el día.
  const ordA = S.hoyOrder[from], ordB = S.hoyOrder[to];
  if (ordB) S.hoyOrder[from] = ordB; else delete S.hoyOrder[from];
  if (ordA) S.hoyOrder[to] = ordA; else delete S.hoyOrder[to];
  await Promise.all([persistDay(from), persistDay(to)]);
}

/** Deja fijos en la rutina del día los ejercicios que agregaste durante una
    sesión. Se ofrece una vez, al cerrarla (SessionView): improvisar en el
    gimnasio no debería reescribir el plan solo, pero repetir a mano lo que ya
    hiciste tampoco tiene sentido.

    Salta los que el día ya tiene (por exKey), así responder que sí dos veces
    no duplica nada. */
export async function pinAddedToRoutine(wd, added) {
  const d = ensureDay(+wd);
  const yaHay = new Set((d.exercises || []).map(exKey));
  const nuevos = (added || [])
    .filter(a => !yaHay.has(exKey(a)))
    .map(a => ({
      id: uid(), name: a.name, sets: a.sets, reps: a.reps,
      equip: a.equip || undefined, machine: a.machine || undefined,
    }));
  if (!nuevos.length) { toast('Ya estaban en tu rutina'); return; }
  pushHistory(`${nuevos.length} ejercicio${nuevos.length === 1 ? '' : 's'} agregado${nuevos.length === 1 ? '' : 's'} al ${WD[+wd].toLowerCase()}`);
  d.exercises = [...(d.exercises || []), ...nuevos];
  await persistDay(+wd);
  bump();
}

export function dayIsFree(wd) {
  const d = S.routine[+wd];
  return !d?.name && !d?.exercises?.length;
}

/** Primer día libre después de `wd`, dando la vuelta a la semana en el orden en
    que se ve (lunes primero). `alsoFree` es el día que va a quedar libre en
    esta misma operación — el origen del arrastre: todavía tiene contenido pero
    lo está por perder, así que cuenta como disponible. null si no queda ninguno. */
export function nextFreeDay(wd, alsoFree) {
  const i = WEEK_ORDER.indexOf(+wd);
  for (let k = 1; k < WEEK_ORDER.length; k++) {
    const cand = WEEK_ORDER[(i + k) % WEEK_ORDER.length];
    if (cand === +alsoFree || dayIsFree(cand)) return cand;
  }
  return null;
}

/** Marca transitoria por día para que el editor pueda animar lo que acaba de
    pasar (`arrive` el que recibió, `bumped` el que se corrió, `left` el que
    quedó vacío). Se limpia sola: es un efecto, no estado que valga guardar. */
let fxTimer = null;
export function setDayFx(map, ms = 900) {
  clearTimeout(fxTimer);
  S.dayFx = map;
  bump();
  fxTimer = setTimeout(() => { S.dayFx = {}; bump(); }, ms);
}

/** Aplica un drop ya decidido. `mode`: 'shift' corre al ocupante del destino al
    próximo día libre; 'swap' intercambia los dos. */
export async function applyDayDrop(fromWd, toWd, mode) {
  const from = +fromWd, to = +toWd;
  if (from === to) return;
  if (hasOpenSession(from) || hasOpenSession(to)) {
    toast('Hay una sesión abierta en esos días — terminala o descartala primero');
    return;
  }
  const moving = S.routine[from]?.name || WD[from];
  const sitting = S.routine[to]?.name || WD[to];

  // Destino libre: no hay nada que decidir, es una mudanza y ya.
  if (dayIsFree(to)) {
    pushHistory(`"${moving}" ahora va el ${WD[to].toLowerCase()}`);
    await moveDayTo(from, to);
    S.rutOpen = to;
    setDayFx({ [to]: 'arrive', [from]: 'left' });
    vibrate(18);
    return;
  }

  // 'shift' sin ningún día libre adonde correr al ocupante degenera en un
  // intercambio. Es el único resultado posible con la semana llena, y decirlo
  // es mejor que hacerlo callado.
  const parked = mode === 'shift' ? nextFreeDay(to, from) : null;
  if (mode === 'swap' || parked === null || parked === from) {
    pushHistory(`"${moving}" va el ${WD[to].toLowerCase()}; "${sitting}" pasó al ${WD[from].toLowerCase()}`);
    await moveDayTo(from, to);
    S.rutOpen = to;
    setDayFx({ [to]: 'arrive', [from]: 'bumped' });
    vibrate([18, 40, 18]);
    return;
  }

  pushHistory(`"${moving}" va el ${WD[to].toLowerCase()}; "${sitting}" se corrió al ${WD[parked].toLowerCase()}`);
  const dragged = S.routine[from];
  const bumped = S.routine[to];
  S.routine[parked] = { ...bumped, weekday: parked };
  S.routine[to] = { ...dragged, weekday: to };
  S.routine[from] = { weekday: from, name: '', exercises: [] };
  // El orden reacomodado en Hoy es por día: sigue a cada rutina a su día nuevo.
  const ordFrom = S.hoyOrder[from], ordTo = S.hoyOrder[to];
  if (ordTo) S.hoyOrder[parked] = ordTo; else delete S.hoyOrder[parked];
  if (ordFrom) S.hoyOrder[to] = ordFrom; else delete S.hoyOrder[to];
  delete S.hoyOrder[from];
  await Promise.all([persistDay(from), persistDay(to), persistDay(parked)]);
  S.rutOpen = to;
  setDayFx({ [to]: 'arrive', [parked]: 'bumped', [from]: 'left' });
  vibrate([18, 40, 18]);
}

/** Dónde terminaría el contenido de cada día si soltaras `from` sobre `to`.
    Devuelve un mapa { weekday origen -> weekday destino }.

    Usa exactamente las mismas reglas que applyDayDrop (nextFreeDay + la
    preferencia S.cfg.dayDrop), así que el preview del arrastre no puede
    mentir: si cambia la regla, cambian los dos a la vez. Con 'ask' se
    previsualiza el corrimiento, que es la primera opción que ofrece el sheet
    day-drop. */
export function previewDayDrop(fromWd, toWd) {
  const from = +fromWd, to = +toWd;
  const map = {};
  if (from === to || dayIsFree(from)) return map;
  map[from] = to;
  if (dayIsFree(to)) return map;
  const parked = S.cfg.dayDrop === 'swap' ? null : nextFreeDay(to, from);
  map[to] = (parked === null || parked === from) ? from : parked;
  return map;
}

/** Punto de entrada del arrastre de días (drag.js). Decide si hace falta
    preguntar; la mecánica está en applyDayDrop(). */
export function dropDayOn(fromWd, toWd) {
  const from = +fromWd, to = +toWd;
  if (from === to || dayIsFree(from)) return;
  if (hasOpenSession(from) || hasOpenSession(to)) {
    toast('Hay una sesión abierta en esos días — terminala o descartala primero');
    return;
  }
  if (dayIsFree(to)) { applyDayDrop(from, to, 'shift'); return; }
  const mode = S.cfg.dayDrop || 'ask';
  if (mode === 'ask') { openSheet('day-drop', { fromWd: from, toWd: to }); return; }
  applyDayDrop(from, to, mode);
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
  await Promise.all(Object.keys(S.routine).map(wd => persistDay(+wd)));
  bump();
  toast('Deshecho', { actionLabel: 'Rehacer', onAction: redoRutina });
}
export async function redoRutina() {
  if (!RUT_REDO.length) return;
  RUT_HISTORY.push(structuredClone(S.routine));
  S.routine = RUT_REDO.pop();
  await Promise.all(Object.keys(S.routine).map(wd => persistDay(+wd)));
  bump();
  toast('Rehecho', { actionLabel: 'Deshacer', onAction: undoRutina });
}
export function clearHistory() { RUT_HISTORY = []; RUT_REDO = []; }

export function ensureDay(wd) {
  if (!S.routine[wd]) S.routine[wd] = { weekday: wd, name: '', exercises: [] };
  return S.routine[wd];
}
export async function persistDay(wd) { await idb.put('routine', S.routine[wd]); }

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

/* ---------- acciones del editor (antes handlers sueltos del ACT{} global) ---------- */
export function enterEditMode() { S.rutMode = 'edit'; bump(); scrollTo({ top: 0, behavior: 'instant' }); }
export function exitEditMode() { S.rutMode = 'view'; clearHistory(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }
/** Abre el editor directo en un día puntual (usado desde DayPeek: "Editar este día") */
export function editDay(wd) { S.rutMode = 'edit'; S.rutOpen = wd; closeSheet(); bump(); scrollTo({ top: 0, behavior: 'instant' }); }

export function toggleDayOpen(wd) { S.rutOpen = S.rutOpen === wd ? null : wd; bump(); }

export async function deleteDay(wd) {
  const d = S.routine[wd];
  if (!d?.name && !d?.exercises?.length) return;
  pushHistory('Día vaciado');
  S.routine[wd] = { weekday: wd, name: '', exercises: [] };
  await persistDay(wd);
  bump();
}

/** Guarda el sheet de día: el nombre y, si cambió, a qué día de la semana va.
    El movimiento no se resuelve acá — se delega en dropDayOn(), el mismo camino
    que usa el arrastre, para que elegir el día con el dedo o con la lista dé
    exactamente el mismo resultado (incluida la pregunta de qué hacer si el
    destino está ocupado). */
export async function saveDay(wd, { name, toWd }) {
  const from = +wd;
  const to = +(toWd ?? wd);

  // El nombre se guarda primero y solo: si el movimiento termina preguntando y
  // cancelás, el nombre igual quedó guardado, que es lo que uno espera de un
  // botón que dice "Guardar".
  ensureDay(from).name = (name || '').trim();
  await persistDay(from);
  closeSheet();
  bump();

  if (to !== from) dropDayOn(from, to);
}

/** Firma adaptada: el original leía $('#f-exname').value etc. directo del DOM
    (ACT['ex-save']->saveExercise); acá ExerciseForm.jsx mantiene esos campos
    como estado de componente y los pasa explícitos. */
export async function saveExercise(wd, exId, { name, sets, reps, equip, machine, photo, illus, cat }) {
  name = (name || '').trim();
  const s = Math.max(1, parseInt(sets) || 4);
  const r = Math.max(1, parseInt(reps) || 10);
  if (!name) { toast('Ponle nombre al ejercicio'); return; }
  const d = ensureDay(wd);
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
    }
  } else {
    d.exercises.push({
      id: uid(), name, sets: s, reps: r,
      equip: equip || undefined,
      machine: equip && machine ? machine.trim() : undefined,
      photo: equip && photo ? photo : undefined,
      illus: illus || undefined,
      cat: cat || undefined,
    });
  }
  await persistDay(wd);
  closeSheet(); bump(); toast('Guardado');
}

export async function deleteExercise(wd, exId) {
  const d = S.routine[wd];
  const ex = d.exercises.find(e => e.id === exId);
  if (!ex) return;
  pushHistory(`"${ex.name}" eliminado`);
  d.exercises = d.exercises.filter(e => e.id !== exId);
  await persistDay(wd);
  bump();
}

/** Sube/baja un ejercicio con las flechas ↑↓ (distinto del drag: acá no hay
    gesto, así que el original anima con flipSort). Deliberadamente NO llama
    bump() acá adentro — igual que el original no llama renderRutina() hasta
    después de `await persistDay`: el llamador (Rutina.jsx) envuelve esta
    función en flipSort(), que necesita medir el DOM ANTES de que la mutación
    se refleje en pantalla. Ver Rutina.jsx: handleMoveEx(). */
export async function moveEx(wd, exId, dir) {
  const d = S.routine[wd];
  const i = d.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.exercises.length) return;
  pushHistory('Ejercicios reordenados');
  [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
  await persistDay(wd);
}

export function startBlank() {
  if (!Object.values(S.routine).some(d => d.exercises?.length)) {
    S.rutMode = 'edit'; closeSheet(); bump(); return;
  }
  openSheet('confirm', {
    title: '¿Vaciar tu split?',
    body: 'Se borran todos los días y ejercicios.',
    confirmLabel: 'Vaciar',
    onConfirm: async () => {
      await idb.clear('routine'); S.routine = {};
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
      S.rutMode = 'view'; S.rutOpen = routineStats().days[0] ?? new Date().getDay();
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
