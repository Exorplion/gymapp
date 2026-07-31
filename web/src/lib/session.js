// Puerto de funciones de sesión desde index.html
import { S, bump, saveDraft, wBoth, openSheet, closeSheet } from './state.js';
import { dstr, uid, round1, WD, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from '../components/Toast.jsx';
import { startRest, stopRest } from './rest.js';
import { scrollCarouselTo } from './carousel.js';
import { fireConfetti } from '../components/Confetti.jsx';

export function lastDataFor(exName) {
  const key = exName.trim().toLowerCase();
  for (const s of S.sessions) {
    const e = (s.entries || []).find(en => en.name.trim().toLowerCase() === key);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

export function ensureVals(ex) {
  if (!S.hoyVals[ex.id]) {
    const last = lastDataFor(ex.name);
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
  if (!S.draft.entries[exId]) S.draft.entries[exId] = { name: ex.name, sets: [] };
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
    .map(([exId, e]) => ({ exId, name: e.name, sets: e.sets }));
  if (!entries.length) { toast('No registraste ninguna serie. Usá "Descartar" para cerrar la sesión.'); return; }
  /* d.open cubre borradores viejos (formato anterior) y el caso raro de que
     falte start; la duración mide de la primera serie al cierre */
  const startAt = d.start || d.open || Date.now();
  const sess = {
    id: d.id, date: d.date, weekday: d.weekday, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries
  };
  const prs = calcSessionPRs(entries);
  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  S.draft = null; S.hoyDay = null;
  await saveDraft();
  stopRest();
  vibrate([30, 50, 30]);
  bump();
  openSheet('session-recap', { sess, prs });
  if (prs.length > 0) fireConfetti();
}

/** Compara la mejor serie de cada ejercicio de la sesión contra el máximo
    histórico ANTES de esta sesión (S.sessions todavía no la incluye acá) */
export function calcSessionPRs(entries) {
  const prior = S.sessions;
  const prs = [];
  entries.forEach(e => {
    if (!e.sets.length) return;
    const bestSet = e.sets.reduce((a, b) => b.w > a.w ? b : a, e.sets[0]);
    let prevMax = 0;
    prior.forEach(s => (s.entries || []).forEach(pe => {
      if (pe.name.trim() !== e.name.trim()) return;
      pe.sets.forEach(st => { if (st.w > prevMax) prevMax = st.w; });
    }));
    if (bestSet.w > prevMax) prs.push({ name: e.name, w: bestSet.w, r: bestSet.r });
  });
  return prs;
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
