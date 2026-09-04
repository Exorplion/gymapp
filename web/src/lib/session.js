// Puerto de funciones de sesión desde index.html
import { S, bump, saveDraft, saveCfg, wBoth, closeSheet } from './state.js';
import { dstr, uid, round1, fmtD, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from './toast.js';
import { startRest, stopRest } from './rest.js';
import { pedirPermiso } from './alarm.js';
import { scrollCarouselTo } from './carousel.js';
import { exKey } from './equip.js';
import { currentStreak, bestStreak } from './streak.js';

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

/** Si HOY este ejercicio se hace un lado por vez.

    Vive en dos capas: lo que dice la rutina (`ex.unilateral`, la config de
    siempre) y lo que anulaste sólo por esta sesión (`S.draft.
    unilateralOverride`, para el día que la máquina te obliga a hacerlo distinto
    de cómo lo planeaste). La sesión gana mientras exista — es "hoy lo hago
    así", no un cambio permanente al plan. */
export function isUnilateral(ex) {
  const o = S.draft?.unilateralOverride;
  if (o && ex?.id in o) return o[ex.id];
  return !!ex?.unilateral;
}

/** Cambia el "un lado por vez" de HOY, sin tocar la rutina. */
export async function toggleUnilateral(exId) {
  if (!S.draft) return;
  const ex = findEx(exId);
  if (!ex) return;
  if (!S.draft.unilateralOverride) S.draft.unilateralOverride = {};
  S.draft.unilateralOverride[exId] = !isUnilateral(ex);
  // si ya hay una entrada para hoy, la etiqueta la sigue — es la misma serie,
  // no una distinta, así que no debería quedar con la etiqueta vieja
  if (S.draft.entries[exId]) S.draft.entries[exId].unilateral = S.draft.unilateralOverride[exId];
  await saveDraft();
  vibrate(8);
  bump();
}

export function ensureVals(ex) {
  if (!S.hoyVals[ex.id]) {
    const last = lastDataFor(ex);
    if (last) { const ls = last[last.length - 1]; S.hoyVals[ex.id] = { w: ls.w, r: ls.r, rpe: null }; }
    else S.hoyVals[ex.id] = { w: 20, r: ex.reps || 10, rpe: null };
  }
  // `rpe` puede faltar en un S.hoyVals guardado antes de que este campo
  // existiera — se completa acá en vez de forzar una migración de datos.
  if (S.hoyVals[ex.id].rpe === undefined) S.hoyVals[ex.id].rpe = null;
  // `side` (izquierda/derecha) sólo importa en unilaterales; en el resto
  // queda en null y saveSet ni lo guarda en el set.
  if (S.hoyVals[ex.id].side === undefined) S.hoyVals[ex.id].side = null;
  return S.hoyVals[ex.id];
}

/** Fija el lado de HOY para un ejercicio unilateral (ver isUnilateral). No
    valida que el ejercicio sea unilateral: elegirlo sin serlo no rompe nada,
    simplemente saveSet no lo va a guardar. */
export function setSide(exId, side) {
  const ex = findEx(exId); if (!ex) return;
  const v = ensureVals(ex);
  v.side = side;
  bump();
}

/** Orden de ejercicios de la sesión: se puede reacomodar mientras el reloj no
    arrancó (la máquina ocupada es la regla, no la excepción). Una vez que
    empezás a entrenar el orden queda fijo. */
export function orderedExs(index, exs) {
  const slotId = S.routine[index]?.id;
  const ord = (S.draft && S.draft.slotId === slotId) ? S.draft.order : S.hoyOrder?.[slotId];
  if (!ord || !ord.length) return exs;
  const by = new Map(exs.map(e => [e.id, e]));
  const out = [];
  ord.forEach(id => { if (by.has(id)) { out.push(by.get(id)); by.delete(id); } });
  by.forEach(e => out.push(e));   // ejercicios nuevos que no estaban en el orden
  return out;
}

export async function setExOrder(index, ids) {
  const slotId = S.routine[index]?.id;
  if (S.draft && S.draft.slotId === slotId) { S.draft.order = ids; await saveDraft(); }
  else { S.hoyOrder = S.hoyOrder || {}; S.hoyOrder[slotId] = ids; }
}

/** Mueve un BLOQUE entero (todos los ejercicios de un grupo muscular, juntos)
    un lugar antes o después del bloque vecino — no ejercicios sueltos, así
    nunca se pueden mezclar dos grupos a la mitad. `exs` es el orden actual
    (orderedExs), `blocksOf` (muscle.js) lo agrupa; acá sólo se swapean dos
    bloques y se aplana de nuevo a una lista de ids para setExOrder, que ya
    sabe dónde persistirla (S.hoyOrder o S.draft.order según haya sesión). */
export async function moveBlock(index, blocks, cat, dir) {
  const i = blocks.findIndex(b => b.cat === cat);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return;
  const next = blocks.slice();
  [next[i], next[j]] = [next[j], next[i]];
  await setExOrder(index, next.flatMap(b => b.exs.map(e => e.id)));
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
export function sessionForSlot(slotId) {
  const ws = weekStart();
  return S.sessions.find(s => s.slotId === slotId && s.date >= ws) || null;
}

/** El turno pendiente según el puntero de la secuencia. */
export function pendingSlot() { return S.routine[S.cfg.seqIndex] || null; }

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
    if (bestSet.w > prevMax) prs.push({ name: e.name, equip: e.equip, machine: e.machine, unilateral: e.unilateral, w: bestSet.w, r: bestSet.r });
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

/** "Tu Año Fierro" (Plan Fierro · Fase 3): recap de solo-lectura sobre los
    últimos 365 días de S.sessions — mismo espíritu que Spotify Wrapped:
    sintetiza lo ya guardado en una historia, sin pedir ningún dato nuevo.
    null si no hay sesiones en la ventana. */
export function yearRecap() {
  const cutoff = Date.now() - 365 * 86400000;
  const sess = S.sessions.filter(s => s.start >= cutoff);
  if (!sess.length) return null;

  let kg = 0, series = 0;
  const porEjercicio = new Map();
  const porDia = new Map(); // date -> kg del día
  for (const s of sess) {
    let kgDia = 0;
    for (const e of s.entries || []) {
      let kgEj = 0;
      for (const st of e.sets || []) { const v = (st.w || 0) * (st.r || 0); kg += v; kgDia += v; kgEj += v; series++; }
      porEjercicio.set(e.name, (porEjercicio.get(e.name) || 0) + kgEj);
    }
    porDia.set(s.date, (porDia.get(s.date) || 0) + kgDia);
  }
  const topEjercicio = [...porEjercicio.entries()].sort((a, b) => b[1] - a[1])[0];
  const diaMasFuerte = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  const prMasGrande = sess
    .flatMap(s => (s.entries || []).flatMap(e => (e.sets || []).map(st => ({ name: e.name, w: st.w, date: s.date }))))
    .sort((a, b) => b.w - a.w)[0];

  return {
    sesiones: sess.length,
    kg: Math.round(kg),
    series,
    ejercicioTop: topEjercicio ? { name: topEjercicio[0], kg: Math.round(topEjercicio[1]) } : null,
    diaMasFuerte: diaMasFuerte ? { date: diaMasFuerte[0], kg: Math.round(diaMasFuerte[1]) } : null,
    prMasGrande: prMasGrande || null,
    rachaMasLarga: bestStreak(),
  };
}

/** Kg totales movidos en toda la historia registrada — cuenta pasiva que
    crece con cada serie, sin depender de ninguna meta activa (Plan Fierro ·
    Fase 1, "Tonelaje de por vida"). */
export function lifetimeTonnage() {
  let kg = 0;
  for (const s of S.sessions) for (const e of s.entries || []) for (const st of e.sets || []) kg += (st.w || 0) * (st.r || 0);
  return Math.round(kg);
}

/** Compara un ejercicio con lo que hiciste hace ~1 año (330-400 días, para no
    depender de que caiga justo un año exacto). null si no hay nada que
    comparar en esa ventana — nunca inventa una fecha. */
export function recallYearAgo(exName) {
  const key = exName.trim().toLowerCase();
  const now = Date.now();
  const MIN = 330 * 86400000, MAX = 400 * 86400000;
  let best = null, bestDist = Infinity;
  for (const s of S.sessions) {
    const age = now - s.start;
    if (age < MIN || age > MAX) continue;
    const e = (s.entries || []).find(en => en.name.trim().toLowerCase() === key);
    if (!e?.sets?.length) continue;
    const dist = Math.abs(age - 365 * 86400000);
    if (dist < bestDist) { bestDist = dist; best = { date: s.date, sets: e.sets }; }
  }
  return best;
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
export function sessionExs(index) {
  const slot = S.routine[index];
  const cambiados = S.draft?.replaced || {};
  const todos = [...(slot?.exercises || []), ...(S.draft?.extras || [])]
    .filter(e => !cambiados[e.id]);   // el que cambiaste ya no está en la lista
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

/** Quitar una serie del objetivo de hoy.

    Sólo saca series que NO hiciste: si el objetivo son 4, llevás 3 y bajás,
    queda en 3 y el ejercicio se cierra. Nunca borra una serie registrada —
    "ya no quiero hacer la cuarta" y "borrá la cuarta que ya hice" son cosas
    distintas, y la segunda tiene su propio gesto en el detalle de la sesión.

    El piso es 1: un ejercicio con cero series objetivo no es un ejercicio. */
export async function dropSet(exId) {
  if (!S.draft) return 0;
  const ex = findEx(exId);
  if (!ex) return 0;
  const hechas = (S.draft.entries?.[exId]?.sets || []).length;
  const actual = targetSets(ex);
  const piso = Math.max(1, hechas);
  if (actual <= piso) {
    toast(hechas ? `Ya hiciste ${hechas} serie${hechas === 1 ? '' : 's'}` : 'Tiene que quedar al menos una');
    return actual;
  }
  if (!S.draft.extraSets) S.draft.extraSets = {};
  S.draft.extraSets[exId] = (S.draft.extraSets[exId] || 0) - 1;

  // si al bajar el objetivo el ejercicio queda completo, se cierra y pasamos al
  // siguiente, igual que cuando lo completás registrando
  const nuevo = targetSets(ex);
  if (hechas >= nuevo && S.draft.cur === exId) {
    /* El turno sale del BORRADOR (slotId), no de un índice mirado aparte:
       podés estar viendo otro turno con la sesión de éste abierta. Con el
       turno equivocado la lista viene vacía y el siguiente ejercicio se
       pierde. */
    const sig = nextPending(sessionExs(S.routine.findIndex(s => s.id === S.draft.slotId)));
    S.draft.cur = sig ? sig.id : null;
  }
  await saveDraft();
  vibrate(15);
  bump();
  return nuevo;
}

/** Un ejercicio que decidiste hacer hoy y no estaba en el plan. Vive sólo en
    el borrador; al cerrar la sesión se ofrece dejarlo fijo en la rutina. */
export async function addSessionExercise({ name, sets, reps, equip, machine, unilateral } = {}, afterExId = null) {
  if (!S.draft) return null;
  const ex = {
    id: uid(),
    name: String(name || '').trim(),
    sets: Math.max(1, parseInt(sets, 10) || 3),
    reps: Math.max(1, parseInt(reps, 10) || 10),
    equip: equip || undefined,
    machine: equip && machine ? machine : undefined,
    unilateral: unilateral || undefined,
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
    excepción. El reemplazo entra justo detrás, así el lugar en el orden del día
    no se altera.

    El original DESAPARECE de la lista en vez de quedar tachado. Antes se
    marcaba como saltado y seguía ocupando una tarjeta: pedías cambiar y te
    quedaban los dos, que es lo contrario de cambiar.

    Pero no se pierde: queda anotado en `replaced` con su nombre, así la tarjeta
    nueva puede decir "en vez de Press banca" y la sesión guardada también. Se
    guarda el NOMBRE y no sólo el id porque el original puede desaparecer de la
    rutina más adelante, y lo que querés leer es el nombre. */
export async function replaceSessionExercise(exId, datos) {
  const orig = findEx(exId);
  const nuevo = await addSessionExercise(datos, exId);
  if (!nuevo) return null;
  if (!S.draft.replaced) S.draft.replaced = {};
  S.draft.replaced[exId] = { by: nuevo.id, name: orig?.name || '' };
  S.draft.cur = nuevo.id;
  await saveDraft();
  bump();
  return nuevo;
}

/** Si este ejercicio entró en lugar de otro, el nombre del que reemplazó. */
export function reemplazaA(exId) {
  const r = S.draft?.replaced;
  if (!r) return null;
  for (const k of Object.keys(r)) if (r[k]?.by === exId) return r[k].name || null;
  return null;
}

export async function saveSet(exId) {
  const ex = findEx(exId); if (!ex) return;
  const v = ensureVals(ex);
  if (!(v.w > 0) || !(v.r > 0)) { toast('Peso y reps deben ser > 0'); return; }
  if (!S.draft) {
    S.draft = { id: uid(), date: dstr(), slotId: pendingSlot()?.id, dayName: pendingSlot()?.name || 'Entrenamiento', start: Date.now(), cur: exId, entries: {} };
  }
  // `cat` se copia SÓLO si es una asignación explícita del ejercicio: sin ella
  // catOf() clasifica por el nombre que la propia entrada ya guarda, así que
  // mejorar el matcher arregla también el historial viejo. Lo que no puede
  // quedar afuera es el override manual, porque ese vive en la rutina y
  // renombrar un ejercicio ahí no debe reescribir el pasado.
  if (!S.draft.entries[exId]) S.draft.entries[exId] = { name: ex.name, equip: ex.equip, machine: ex.machine, cat: ex.cat, unilateral: isUnilateral(ex), sets: [] };
  const cur = S.draft.entries[exId].sets;
  /* el objetivo es el techo: llegado a él el ejercicio se cierra solo y pasamos
     al siguiente, en vez de dejar registrar series infinitas. El techo de HOY
     incluye las series extra concedidas a mano (targetSets) — sin eso "+ Serie"
     no tendría efecto. */
  const techo = targetSets(ex);
  if (cur.length >= techo) { toast(`${ex.name} ya está completo (${techo} series)`); return; }
  // rpe (1-10, esfuerzo percibido) es opcional — v.rpe queda en null si no
  // se tocó el selector. Es el campo que destraba ACWR y la recuperación
  // muscular por esfuerzo (Plan Fierro · Fase 2).
  const uni = isUnilateral(ex);
  cur.push({ w: round1(v.w), r: v.r, t: Date.now(), rpe: v.rpe ?? null, side: uni ? (v.side || null) : null });
  v.rpe = null; // cada serie arranca sin RPE elegido; no se arrastra de la anterior
  // alterna el lado solo — así la próxima serie ya arranca del otro sin que
  // haya que tocar el selector a mano
  if (uni && v.side) v.side = v.side === 'left' ? 'right' : 'left';
  if (!S.draft.start) S.draft.start = Date.now();
  const finished = cur.length >= techo;
  const exs = sessionExs(S.routine.findIndex(s => s.id === S.draft.slotId));
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

/* Hitos raros, no diarios (Plan Fierro · Fase 1): confetti completo SOLO en
   momentos que de verdad son un logro, para que la moneda no se devalúe
   gastándose en cada serie. Se comparan sobre el estado ANTES de esta
   sesión: cruzar el umbral, no simplemente estar arriba de él, es lo que
   hace que sea un hito y no una racha de confetti en cada sesión siguiente. */
const TONNAGE_MILESTONES = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const SESSION_MILESTONES = [10, 25, 50, 100, 250, 500];
const STREAK_MILESTONES = [7, 30, 100, 365];
function crossedMilestone(before, after, list) {
  return list.find(m => before < m && after >= m) ?? null;
}

export async function completeSession() {
  if (!S.draft) return;
  const d = S.draft;
  const slot = S.routine.find(s => s.id === d.slotId);
  /* el orden real de la sesión manda sobre el de la rutina (se pudo reacomodar) */
  const order = (d.order && d.order.length) ? d.order : (slot?.exercises || []).map(e => e.id);
  const entries = Object.entries(d.entries)
    .sort((a, b) => { const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); })
    .map(([exId, e]) => ({ exId, name: e.name, equip: e.equip, machine: e.machine, cat: e.cat, unilateral: e.unilateral, sets: e.sets }));
  if (!entries.length) { toast('No registraste ninguna serie. Usá "Descartar" para cerrar la sesión.'); return; }
  /* d.open cubre borradores viejos (formato anterior) y el caso raro de que
     falte start; la duración mide de la primera serie al cierre */
  const startAt = d.start || d.open || Date.now();
  /* Los salteados no tienen series, así que nunca entraron en d.entries: no
     suman volumen, no compiten por PRs, no tocan el gráfico de carga. Se
     guardan aparte para que dentro de un mes sepas si ese día no tocaba peso
     muerto o si lo dejaste pasar. */
  const todos = sessionExs(S.routine.findIndex(s => s.id === d.slotId));
  const skipped = (d.skipped || [])
    .map(id => todos.find(e => e.id === id))
    .filter(Boolean)
    .map(e => ({ name: e.name, equip: e.equip, machine: e.machine }));
  /* Los agregados que de verdad hiciste (los que tienen series). Uno que
     agregaste y después salteaste no tiene por qué ofrecerse para el plan. */
  const added = (d.extras || [])
    .filter(e => d.entries[e.id]?.sets?.length)
    .map(e => ({ name: e.name, sets: e.sets, reps: e.reps, equip: e.equip, machine: e.machine, unilateral: e.unilateral }));

  const sess = {
    id: d.id, date: d.date, slotId: d.slotId, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries,
    ...(skipped.length ? { skipped } : {}),
    ...(added.length ? { added } : {}),
  };
  // Snapshot ANTES de insertar la sesión — los tres milestones (tonelaje,
  // sesiones, racha) se miden por si el umbral se CRUZA con esta sesión, no
  // por si ya estabas arriba de él.
  const tonnageBefore = lifetimeTonnage();
  const sessionsBefore = S.sessions.length;
  const streakBefore = currentStreak();

  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  // sessionPRs filtra por start < sess.start, así que la sesión recién
  // insertada se excluye sola: da lo mismo calcular antes o después de guardar.
  const prs = sessionPRs(sess);
  S.draft = null;

  const milestone =
    crossedMilestone(streakBefore, currentStreak(), STREAK_MILESTONES) && { type: 'racha', value: currentStreak() } ||
    crossedMilestone(sessionsBefore, S.sessions.length, SESSION_MILESTONES) && { type: 'sesiones', value: S.sessions.length } ||
    crossedMilestone(tonnageBefore, lifetimeTonnage(), TONNAGE_MILESTONES) && { type: 'tonelaje', value: lifetimeTonnage() } ||
    null;

  // Avanza el puntero al turno siguiente al que se acaba de completar,
  // buscando por id (no por índice guardado): si reordenaste la secuencia
  // mientras entrenabas, esto sigue apuntando al lugar correcto.
  const finishedAt = S.routine.findIndex(s => s.id === d.slotId);
  S.cfg.seqIndex = finishedAt >= 0 ? (finishedAt + 1) % Math.max(1, S.routine.length) : S.cfg.seqIndex;
  S.cfg.seqIndexDate = dstr();
  await Promise.all([saveDraft(), saveCfg()]);
  stopRest();
  vibrate([30, 50, 30]);
  // Antes acá se abría directo el sheet de detalle (session-view). Ahora
  // primero pasa la pantalla de racha/resumen/cuerpo (SessionComplete.jsx,
  // montada en App.jsx) — ella es quien abre session-view cuando termina o
  // la salteás tocando. El confetti de PRs YA NO se dispara acá: el sheet
  // que muestra el PR recién abre ~3.65s después (al final de esa pantalla),
  // y la animación de confetti dura ~2.7s — se veía y se apagaba entero
  // mientras el usuario todavía miraba racha/resumen, antes de que el PR
  // fuera visible. Se guarda si hubo PR junto con la sesión, y es
  // SessionComplete.jsx quien dispara fireConfetti() al abrir session-view.
  S.sessionComplete = { ...sess, huboPR: prs.length > 0, milestone };
  bump();
}

/** Abre el borrador de sesión (weekday `wd`, con el orden ya reacomodado si
    hubo drag-to-reorder antes de arrancar). El cronómetro NO arranca acá —
    arranca en startExercise(), cuando de verdad estás en la máquina. */
export async function startSession(index, precheckAdjust = 0) {
  const slot = S.routine[index];
  if (!slot?.exercises?.length) { toast('Este turno no tiene ejercicios'); return; }
  // Acá y no al terminar el primer descanso: abrir la sesión es un toque de
  // botón, que es el gesto que los navegadores exigen para poder preguntar.
  pedirPermiso();
  S.draft = {
    id: uid(), date: dstr(), slotId: slot.id, dayName: slot.name || 'Entrenamiento', open: Date.now(), start: null, cur: null,
    order: orderedExs(index, slot.exercises).map(e => e.id), entries: {},
    // lo que se puede cambiar sin tocar el plan: ver "modificar la sesión
    // mientras entrenás" más arriba
    skipped: [], extraSets: {}, extras: [],
    // Chequeo de 3 preguntas (Plan Fierro · Fase 3): ±% sobre el peso
    // sugerido de HOY, ver precheckAdjust() en Hoy.jsx. 0 = sin ajuste.
    precheckAdjust,
  };
  await saveDraft();
  closeSheet();
  vibrate(15);
  bump();
  toast('Sesión abierta · tocá "Iniciar ejercicio" cuando estés en la máquina');
}

export async function discardSession() {
  S.draft = null;
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

function findEx(exId) {
  // los agregados durante la sesión viven en el borrador, no en la rutina
  const extra = (S.draft?.extras || []).find(x => x.id === exId);
  if (extra) return extra;
  for (const slot of S.routine) {
    const e = (slot.exercises || []).find(x => x.id === exId);
    if (e) return e;
  }
  return null;
}
