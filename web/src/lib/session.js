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

/** Agrupa series CONSECUTIVAS del mismo peso.

    Es como se habla en el gimnasio: no "85×7, 85×6" sino "85 por 7 y 6". Deja
    que el peso —que es el dato— se muestre una vez y grande, con las reps al
    lado, en vez de repetirlo en cada línea.

    Consecutivas y no por valor: si subiste y volviste a bajar, esos son dos
    momentos distintos de la sesión y fusionarlos borraría el orden real. */
export function groupSets(sets) {
  const out = [];
  (sets || []).forEach((s, i) => {
    const ult = out[out.length - 1];
    if (ult && ult.w === s.w) ult.reps.push(s.r);
    // `from` es el número de la primera serie del grupo (1-based): agrupar por
    // peso no puede costar saber qué serie fue cada una, así que la numeración
    // sigue siendo continua a lo largo de todo el ejercicio.
    else out.push({ w: s.w, reps: [s.r], from: i + 1 });
  });
  return out;
}

/** Cuánto cambió la mejor serie de este ejercicio respecto de la última vez
    que lo hiciste antes de esta sesión.

    Compara por exKey, así que el mismo nombre con otro equipo no cuenta como
    la misma serie histórica — es justo lo que equip.js existe para separar.
    Devuelve null si no hay con qué comparar: nunca se inventa una tendencia. */
export function entryDelta(sess, entry) {
  if (!entry?.sets?.length) return null;
  const key = exKey(entry);
  const actual = entry.sets.reduce((a, b) => (b.w > a.w ? b : a), entry.sets[0]).w;
  const previas = S.sessions
    .filter(s => s.id !== sess.id && s.start < sess.start)
    .sort((a, b) => b.start - a.start);
  for (const s of previas) {
    const e = (s.entries || []).find(x => exKey(x) === key && x.sets?.length);
    if (!e) continue;
    const anterior = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]).w;
    return { delta: round1(actual - anterior), anterior, actual };
  }
  return null;
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
export function nextPending(list) {
  return list.find(e => !isSkipped(e.id) && setsDone(e.id).length < targetSets(e)) || null;
}

/* ================= modificar la sesión mientras entrenás =================
   Todo esto vive en S.draft y NO toca S.routine: improvisar en el gimnasio no
   debería reescribir tu plan. Los tres campos (skipped/extraSets/extras) se
   leen siempre con `?.` y un default, así que un borrador guardado antes de
   este cambio sigue funcionando sin migración. */

/** Series objetivo de HOY: las de la rutina más las concedidas a mano. Sin
    esto el ejercicio se cierra solo al llegar al objetivo — que es su diseño
    ("el objetivo es el techo"), pero deja sin salida al día que querés hacer
    una serie más. */
export function targetSets(ex) {
  return (ex?.sets || 0) + (S.draft?.extraSets?.[ex?.id] || 0);
}

export function isSkipped(exId) { return !!S.draft?.skipped?.includes(exId); }

/** Los ejercicios de la sesión: los del día más los agregados hoy, en el orden
    del borrador. Reemplaza a orderedExs() mientras hay sesión abierta. */
export function sessionExs(wd) {
  const todos = [...(S.routine[wd]?.exercises || []), ...(S.draft?.extras || [])];
  const ord = S.draft?.order;
  if (!ord?.length) return todos;
  const by = new Map(todos.map(e => [e.id, e]));
  const out = [];
  ord.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
  by.forEach(e => out.push(e));   // ejercicios que no estaban en el orden
  return out;
}

/** Saltar no toca el orden — sólo marca. Por eso restablecer devuelve el
    ejercicio exactamente a donde estaba, sin recordar ninguna posición. */
export async function skipExercise(exId) {
  if (!S.draft) return;
  if (!S.draft.skipped) S.draft.skipped = [];
  if (!S.draft.skipped.includes(exId)) S.draft.skipped.push(exId);
  if (S.draft.cur === exId) S.draft.cur = null;
  await saveDraft();
  vibrate(15);
  bump();
}

export async function unskipExercise(exId) {
  if (!S.draft?.skipped) return;
  S.draft.skipped = S.draft.skipped.filter(id => id !== exId);
  await saveDraft();
  vibrate(15);
  bump();
}

/** Una serie más sobre el objetivo, sólo por hoy. */
export async function addExtraSet(exId) {
  if (!S.draft) return 0;
  if (!S.draft.extraSets) S.draft.extraSets = {};
  S.draft.extraSets[exId] = (S.draft.extraSets[exId] || 0) + 1;
  // si estaba cerrado por haber llegado al objetivo, vuelve a ser el actual
  if (!S.draft.cur) S.draft.cur = exId;
  await saveDraft();
  vibrate(15);
  bump();
  return S.draft.extraSets[exId];
}

/** Un ejercicio que decidiste hacer hoy y no estaba en el plan. Vive sólo en
    el borrador; al cerrar la sesión se ofrece dejarlo fijo en la rutina. */
export async function addSessionExercise({ name, sets, reps, equip, machine } = {}, afterExId = null) {
  if (!S.draft) return null;
  const ex = {
    id: uid(),
    name: String(name || '').trim(),
    sets: Math.max(1, parseInt(sets, 10) || 3),
    reps: Math.max(1, parseInt(reps, 10) || 10),
    equip: equip || undefined,
    machine: equip && machine ? machine : undefined,
  };
  if (!ex.name) return null;
  if (!S.draft.extras) S.draft.extras = [];
  S.draft.extras.push(ex);
  if (!S.draft.order) S.draft.order = [];
  const i = afterExId ? S.draft.order.indexOf(afterExId) : -1;
  if (i >= 0) S.draft.order.splice(i + 1, 0, ex.id);
  else S.draft.order.push(ex.id);
  await saveDraft();
  vibrate(15);
  bump();
  return ex;
}

/** Cambiar un ejercicio por otro: la máquina ocupada es la regla, no la
    excepción. Es saltar el original y meter el reemplazo justo detrás, así el
    lugar en el orden del día no se altera. */
export async function replaceSessionExercise(exId, datos) {
  const nuevo = await addSessionExercise(datos, exId);
  if (!nuevo) return null;
  await skipExercise(exId);
  S.draft.cur = nuevo.id;
  await saveDraft();
  bump();
  return nuevo;
}

export async function saveSet(exId) {
  const ex = findEx(exId); if (!ex) return;
  const v = ensureVals(ex);
  if (!(v.w > 0) || !(v.r > 0)) { toast('Peso y reps deben ser > 0'); return; }
  const wd = currentDayForHoy();
  if (!S.draft) {
    S.draft = { id: uid(), date: dstr(), weekday: wd, dayName: S.routine[wd]?.name || WD[wd], start: Date.now(), cur: exId, entries: {} };
  }
  // `cat` se copia SÓLO si es una asignación explícita del ejercicio: sin ella
  // catOf() clasifica por el nombre que la propia entrada ya guarda, así que
  // mejorar el matcher arregla también el historial viejo. Lo que no puede
  // quedar afuera es el override manual, porque ese vive en la rutina y
  // renombrar un ejercicio ahí no debe reescribir el pasado.
  if (!S.draft.entries[exId]) S.draft.entries[exId] = { name: ex.name, equip: ex.equip, machine: ex.machine, cat: ex.cat, sets: [] };
  const cur = S.draft.entries[exId].sets;
  /* el objetivo es el techo: llegado a él el ejercicio se cierra solo y pasamos
     al siguiente, en vez de dejar registrar series infinitas. El techo de HOY
     incluye las series extra concedidas a mano (targetSets) — sin eso "+ Serie"
     no tendría efecto. */
  const techo = targetSets(ex);
  if (cur.length >= techo) { toast(`${ex.name} ya está completo (${techo} series)`); return; }
  cur.push({ w: round1(v.w), r: v.r, t: Date.now() });
  if (!S.draft.start) S.draft.start = Date.now();
  const finished = cur.length >= techo;
  const exs = sessionExs(S.draft.weekday);
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
    .map(([exId, e]) => ({ exId, name: e.name, equip: e.equip, machine: e.machine, cat: e.cat, sets: e.sets }));
  if (!entries.length) { toast('No registraste ninguna serie. Usá "Descartar" para cerrar la sesión.'); return; }
  /* d.open cubre borradores viejos (formato anterior) y el caso raro de que
     falte start; la duración mide de la primera serie al cierre */
  const startAt = d.start || d.open || Date.now();
  /* Los salteados no tienen series, así que nunca entraron en d.entries: no
     suman volumen, no compiten por PRs, no tocan el gráfico de carga. Se
     guardan aparte para que dentro de un mes sepas si ese día no tocaba peso
     muerto o si lo dejaste pasar. */
  const todos = sessionExs(d.weekday);
  const skipped = (d.skipped || [])
    .map(id => todos.find(e => e.id === id))
    .filter(Boolean)
    .map(e => ({ name: e.name, equip: e.equip, machine: e.machine }));
  /* Los agregados que de verdad hiciste (los que tienen series). Uno que
     agregaste y después salteaste no tiene por qué ofrecerse para el plan. */
  const added = (d.extras || [])
    .filter(e => d.entries[e.id]?.sets?.length)
    .map(e => ({ name: e.name, sets: e.sets, reps: e.reps, equip: e.equip, machine: e.machine }));

  const sess = {
    id: d.id, date: d.date, weekday: d.weekday, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries,
    ...(skipped.length ? { skipped } : {}),
    ...(added.length ? { added } : {}),
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
    // lo que se puede cambiar sin tocar el plan: ver "modificar la sesión
    // mientras entrenás" más arriba
    skipped: [], extraSets: {}, extras: [],
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
  // los agregados durante la sesión viven en el borrador, no en la rutina
  const extra = (S.draft?.extras || []).find(x => x.id === exId);
  if (extra) return extra;
  for (const d of Object.values(S.routine)) {
    const e = (d.exercises || []).find(x => x.id === exId);
    if (e) return e;
  }
  return null;
}
