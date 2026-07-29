// Puerto de funciones de sesión desde index.html
import { S, bump, saveDraft } from './state.js';
import { dstr, uid, wBoth, WD, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from '../components/Toast.jsx';
// Imports con comentarios de dependencias (serán ported en tareas posteriores):
// import { startRest } from './rest.js'; // Task 3
// import { sheetSessionRecap } from './components/SessionRecap.jsx'; // Task 6
// import { fireConfetti } from './components/Confetti.jsx'; // Task 6

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
  // startRest(); // Task 3 dependency
  if (finished) {
    toast(nxt ? `✓ ${ex.name} completo · sigue ${nxt.name}` : `✓ ${ex.name} completo · terminaste el día`);
    // scrollCarouselTo(nxt ? nxt.id : exId); // Task 6 dependency
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
  // stopRest(); // Task 3 dependency
  vibrate([30, 50, 30]);
  bump();
  // sheetSessionRecap(sess, prs); // Task 6 dependency
  // if (prs.length > 0) fireConfetti(); // Task 6 dependency
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

// === Helper functions ===
function currentDayForHoy() { return S.hoyDay ?? new Date().getDay(); }

function findEx(exId) {
  for (const d of Object.values(S.routine)) {
    const e = (d.exercises || []).find(x => x.id === exId);
    if (e) return e;
  }
  return null;
}
