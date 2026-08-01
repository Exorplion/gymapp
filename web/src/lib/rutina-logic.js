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
/* snapshot del split actual, sin ids: al aplicarlo se generan nuevos */
export function routineSnapshot() {
  const days = {};
  WEEK_ORDER.forEach(wd => {
    const d = S.routine[wd];
    if (!d?.exercises?.length) return;
    days[wd] = { name: d.name || WD[wd], exercises: d.exercises.map(e => ({ name: e.name, sets: e.sets, reps: e.reps })) };
  });
  return days;
}
export async function saveLib() { await idb.put('settings', { key: 'lib', value: S.lib }); }
export async function applyDays(days, name) {
  await idb.clear('routine');
  S.routine = {};
  for (const wd in days) {
    S.routine[wd] = {
      weekday: +wd, name: days[wd].name,
      exercises: days[wd].exercises.map(e => ({ id: uid(), name: e.name, sets: e.sets, reps: e.reps })),
    };
    await persistDay(+wd);
  }
  S.cfg.routineName = name;
  await saveCfg();
}
export function swapDayContents(newOrderIds) {
  const active = activeDayWds();
  const snapshot = active.map(wd => S.routine[wd]);
  const proms = [];
  active.forEach((wd, i) => {
    const fromWd = +newOrderIds[i];
    const srcIdx = active.indexOf(fromWd);
    S.routine[wd] = srcIdx >= 0 ? { ...snapshot[srcIdx], weekday: wd } : ensureDay(wd);
    proms.push(persistDay(wd));
  });
  return Promise.all(proms);
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

export async function saveDayName(wd, name) {
  const d = ensureDay(wd);
  d.name = (name || '').trim();
  await persistDay(wd);
  closeSheet();
  bump();
}

/** Firma adaptada: el original leía $('#f-exname').value etc. directo del DOM
    (ACT['ex-save']->saveExercise); acá ExerciseForm.jsx mantiene esos campos
    como estado de componente y los pasa explícitos. */
export async function saveExercise(wd, exId, { name, sets, reps, equip, machine }) {
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
    }
  } else {
    d.exercises.push({
      id: uid(), name, sets: s, reps: r,
      equip: equip || undefined,
      machine: equip && machine ? machine.trim() : undefined,
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
