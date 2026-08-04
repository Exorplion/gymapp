// Puerto de funciones de sesión desde index.html
import { S, bump, saveDraft, wBoth, openSheet, closeSheet } from './state.js';
import { dstr, uid, round1, WD, fmtD, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from './toast.js';
import { startRest, stopRest } from './rest.js';
import { scrollCarouselTo } from './carousel.js';
import { fireConfetti } from './confetti.js';
import { exKey } from './equip.js';

/** Última vez que hiciste ESTE ejercicio con ESTE equipo. Acepta el objeto
    ejercicio completo; un string sigue funcionando y se compara sólo por
    nombre, que es como se comportaba antes de existir el equipamiento. */
export function lastDataFor(ex) {
  const key = typeof ex === 'string' ? ex.trim().toLowerCase() : exKey(ex);
  for (const s of S.sessions) {
    const e = (s.entries || []).find(en => exKey(en) === key);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

export function ensureVals(ex) {
  if (!S.hoyVals[ex.id]) {
    const last = lastDataFor(ex);
    if (last) { const ls = last[last.length - 1]; S.hoyVals[ex.id] = { w: ls.w, r: ls.r }; }
    else S.hoyVals[ex.id] = { w: 20, r: ex.reps || 10 };
  }
  return S.hoyVals[ex.id];
}

/** Orden de ejercicios de la sesión: se puede reacomodar mientras el reloj no
    arrancó (la máquina ocupada es la regla, no la excepción). Una vez que
    empezás a entrenar el orden queda fijo. */
export function orderedExs(wd, exs) {
  const ord = (S.draft && S.draft.weekday === wd) ? S.draft.order : S.hoyOrder[wd];
  if (!ord || !ord.length) return exs;
  const by = new Map(exs.map(e => [e.id, e]));
  const out = [];
  ord.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
  by.forEach(e => out.push(e));   // ejercicios nuevos que no estaban en el orden
  return out;
}

export async function setExOrder(wd, ids) {
  if (S.draft && S.draft.weekday === wd) { S.draft.order = ids; await saveDraft(); }
  else S.hoyOrder[wd] = ids;
}

export function setsDone(exId) { return S.draft?.entries[exId]?.sets || []; }

/** El lunes de la semana de `d`, en YYYY-MM-DD. La semana arranca el lunes
    porque es el orden en que la app muestra los días (WEEK_ORDER). */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // domingo (0) cae 6 días atrás
  return dstr(x);
}

/** La sesión de ese día de la semana dentro de la semana en curso, o null.

    La ventana es "esta semana" y no "hoy" a propósito: cubre tanto "ya entrené
    hoy" como "miro el lunes que ya hice". Un día futuro de esta semana todavía
    no tiene sesión, así que sigue ofreciendo entrenar — adelantar el jueves a
    un martes es legítimo y no hay que bloquearlo.

    S.sessions está ordenado descendente por start, así que find() da la más
    reciente. */
export function sessionForWeekday(wd) {
  const ws = weekStart();
  return S.sessions.find(s => s.weekday === +wd && s.date >= ws) || null;
}

/** Récords de `sess`: la mejor serie de cada ejercicio contra el máximo de las
    sesiones ANTERIORES a ella. Sirve para cualquier sesión, esté o no todavía
    en S.sessions — reemplaza a calcSessionPRs(), que asumía que la sesión no
    estaba en la lista y por eso sólo servía en el momento de cerrarla. */
export function sessionPRs(sess) {
  const prior = S.sessions.filter(s => s.id !== sess.id && s.start < sess.start);
  const prs = [];
  (sess.entries || []).forEach(e => {
    if (!e.sets?.length) return;
    const bestSet = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]);
    let prevMax = 0;
    prior.forEach(s => (s.entries || []).forEach(pe => {
      if (exKey(pe) !== exKey(e)) return;
      pe.sets.forEach(st => { if (st.w > prevMax) prevMax = st.w; });
    }));
    if (bestSet.w > prevMax) prs.push({ name: e.name, equip: e.equip, machine: e.machine, w: bestSet.w, r: bestSet.r });
  });
  return prs;
}

/** Agrupa sesiones por semana calendario, conservando el orden de entrada. */
export function groupSessionsByWeek(list) {
  const ws = weekStart();
  const prevWs = weekStart(new Date(new Date(ws + 'T12:00:00').getTime() - 7 * 86400000));
  const groups = [];
  const byKey = new Map();
  (list || []).forEach(s => {
    const k = weekStart(new Date(s.date + 'T12:00:00'));
    let g = byKey.get(k);
    if (!g) {
      const label = k === ws ? 'Esta semana' : k === prevWs ? 'Semana pasada' : `Semana del ${fmtD(k)}`;
      g = { key: k, label, sessions: [] };
      byKey.set(k, g);
      groups.push(g);
    }
    g.sessions.push(s);
  });
  return groups;
}

/** Guarda una sesión del historial ya editada.

    `start`, `end`, `duration`, `date`, `weekday` y `dayName` no se tocan nunca:
    el tiempo que quedó registrado en el gimnasio es un hecho medido, corregir
    un peso no lo cambia. El toast de Deshacer restaura el snapshot previo. */
export async function updateHistorySession(sess, msg = 'Sesión actualizada') {
  const i = S.sessions.findIndex(s => s.id === sess.id);
  const snapshot = i >= 0 ? structuredClone(S.sessions[i]) : null;
  if (i >= 0) S.sessions[i] = sess;
  await idb.put('sessions', sess);
  bump();
  toast(msg, {
    actionLabel: 'Deshacer',
    onAction: async () => {
      if (!snapshot) return;
      const j = S.sessions.findIndex(s => s.id === snapshot.id);
      if (j >= 0) S.sessions[j] = snapshot;
      await idb.put('sessions', snapshot);
      bump();
    },
  });
}

/** Siguiente ejercicio pendiente en el orden actual */
export function nextPending(list) { return list.find(e => setsDone(e.id).length < e.sets) || null; }

export async function saveSet(exId) {
  const ex = findEx(exId); if (!ex) return;
  const v = ensureVals(ex);
  if (!(v.w > 0) || !(v.r > 0)) { toast('Peso y reps deben ser > 0'); return; }
  const wd = currentDayForHoy();
  if (!S.draft) {
    S.draft = { id: uid(), date: dstr(), weekday: wd, dayName: S.routine[wd]?.name || WD[wd], start: Date.now(), cur: exId, entries: {} };
  }
  if (!S.draft.entries[exId]) S.draft.entries[exId] = { name: ex.name, equip: ex.equip, machine: ex.machine, sets: [] };
  const cur = S.draft.entries[exId].sets;
  /* el objetivo es el techo: llegado a él el ejercicio se cierra solo y pasamos
     al siguiente, en vez de dejar registrar series infinitas */
  if (cur.length >= ex.sets) { toast(`${ex.name} ya está completo (${ex.sets} series)`); return; }
  cur.push({ w: round1(v.w), r: v.r, t: Date.now() });
  if (!S.draft.start) S.draft.start = Date.now();
  const finished = cur.length >= ex.sets;
  const exs = orderedExs(S.draft.weekday, S.routine[S.draft.weekday]?.exercises || []);
  const nxt = finished ? nextPending(exs) : null;
  if (finished) S.draft.cur = null;
  await saveDraft();
  vibrate(finished ? [25, 60, 25] : 15);
  bump();
  startRest();
  if (finished) {
    toast(nxt ? `✓ ${ex.name} completo · sigue ${nxt.name}` : `✓ ${ex.name} completo · terminaste el día`);
    scrollCarouselTo(nxt ? nxt.id : exId);
  } else {
    toast(`Serie ${cur.length}/${ex.sets}: ${wBoth(v.w)} × ${v.r}`);
  }
}

export async function completeSession() {
  if (!S.draft) return;
  const d = S.draft;
  const wdDay = S.routine[d.weekday];
  /* el orden real de la sesión manda sobre el de la rutina (se pudo reacomodar) */
  const order = (d.order && d.order.length) ? d.order : (wdDay?.exercises || []).map(e => e.id);
  const entries = Object.entries(d.entries)
    .sort((a, b) => { const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); })
    .map(([exId, e]) => ({ exId, name: e.name, equip: e.equip, machine: e.machine, sets: e.sets }));
  if (!entries.length) { toast('No registraste ninguna serie. Usá "Descartar" para cerrar la sesión.'); return; }
  /* d.open cubre borradores viejos (formato anterior) y el caso raro de que
     falte start; la duración mide de la primera serie al cierre */
  const startAt = d.start || d.open || Date.now();
  const sess = {
    id: d.id, date: d.date, weekday: d.weekday, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries
  };
  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  // sessionPRs filtra por start < sess.start, así que la sesión recién
  // insertada se excluye sola: da lo mismo calcular antes o después de guardar.
  const prs = sessionPRs(sess);
  S.draft = null; S.hoyDay = null;
  await saveDraft();
  stopRest();
  vibrate([30, 50, 30]);
  bump();
  openSheet('session-view', { id: sess.id, justFinished: true });
  if (prs.length > 0) fireConfetti();
}

/** Abre el borrador de sesión (weekday `wd`, con el orden ya reacomodado si
    hubo drag-to-reorder antes de arrancar). El cronómetro NO arranca acá —
    arranca en startExercise(), cuando de verdad estás en la máquina. */
export async function startSession(wd) {
  const day = S.routine[wd];
  if (!day?.exercises?.length) { toast('Este día no tiene ejercicios'); return; }
  S.draft = {
    id: uid(), date: dstr(), weekday: wd, dayName: day.name || WD[wd], open: Date.now(), start: null, cur: null,
    order: orderedExs(wd, day.exercises).map(e => e.id), entries: {},
  };
  await saveDraft();
  closeSheet();
  vibrate(15);
  bump();
  toast('Sesión abierta · tocá "Iniciar ejercicio" cuando estés en la máquina');
}

export async function discardSession() {
  S.draft = null; S.hoyDay = null;
  await saveDraft();
  stopRest();
  bump();
}

/** Marca `ex` como el ejercicio en curso; arranca el cronómetro de sesión la
    primera vez (cuando tocás "Iniciar ejercicio" ya estás en la máquina). */
export async function startExercise(ex) {
  if (!S.draft) { toast('Primero iniciá el entrenamiento'); return; }
  S.draft.cur = ex.id;
  const first = !S.draft.start;
  if (first) S.draft.start = Date.now();
  await saveDraft();
  vibrate(15);
  bump();
  scrollCarouselTo(ex.id);
  toast(first ? `⏱ Cronómetro en marcha · ${ex.name}` : `${ex.name} · serie 1 de ${ex.sets}`);
}

/** Borra una serie ya registrada (chip ✕). Si el ejercicio quedaba cerrado
    (full) vuelve a quedar abierto — vaciarle una serie lo reabre. */
export async function deleteSet(exId, i) {
  const e = S.draft?.entries[exId]; if (!e) return;
  e.sets.splice(i, 1);
  if (!e.sets.length) delete S.draft.entries[exId];
  if (S.draft && !S.draft.cur) S.draft.cur = exId;
  if (S.draft && !Object.keys(S.draft.entries).length && !S.draft.start) S.draft.cur = null;
  await saveDraft();
  bump();
}

export async function deleteHistorySession(id) {
  await idb.del('sessions', id);
  S.sessions = S.sessions.filter(s => s.id !== id);
  bump();
}

// === Helper functions ===
export function currentDayForHoy() { return S.hoyDay ?? new Date().getDay(); }

function findEx(exId) {
  for (const d of Object.values(S.routine)) {
    const e = (d.exercises || []).find(x => x.id === exId);
    if (e) return e;
  }
  return null;
}
