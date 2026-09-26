// Puerto de funciones de sesión desde index.html
import { S, bump, saveDraft, saveCfg, wBoth, closeSheet } from './state.js';
import { dstr, uid, round1, fmtD, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from './toast.js';
import { T, startRest, stopRest, pedirRir, marcarRirElegido } from './rest.js';
import { rirScheme } from './exdb.js';
import { rirPedido } from './rir.js';
import { rpeFromRir } from './rir.js';
import { pedirPermiso } from './alarm.js';
import { exKey, isBodyweight } from './equip.js';
import { progresion } from './progression.js';
import { currentStreak, bestStreak } from './streak.js';
import { bloqueDe, DESCANSO } from './warmup.js';

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

/** Cambia el "un lado por vez" de HOY. Si todavía no registraste ninguna
    serie de este ejercicio hoy, el cambio queda FIJO en la rutina (D5): la
    semana que viene la app ya sabe que este ejercicio es unilateral, tal
    como pidió Enzo, sin tener que repetir el toggle cada sesión.

    Si ya hay series registradas hoy, el cambio se BLOQUEA: esas filas ya
    quedaron indexadas con exKey() de la lateralidad vieja (ver D3 en la
    spec), y darlas vuelta a mitad de camino mezclaría dos historiales que
    tienen que quedar separados. Cambiar antes de la primera serie es
    gratis; después, no. */
export async function toggleUnilateral(exId) {
  if (!S.draft) return;
  const ex = findEx(exId);
  if (!ex) return;
  if (S.draft.entries[exId]?.sets?.length) {
    toast('Ya registraste series de este ejercicio hoy — el cambio se aplica la próxima vez');
    return;
  }
  const nuevo = !isUnilateral(ex);
  ex.unilateral = nuevo;
  // Persistir en la rutina real, no sólo en el override de hoy: encontrar el
  // slot que contiene este ejercicio (puede ser un extra de hoy, que no vive
  // en S.routine — ahí no hay nada que persistir más que el borrador).
  const slotIndex = S.routine.findIndex(slot => (slot.exercises || []).some(e => e.id === exId));
  if (slotIndex >= 0) {
    // Import dinámico para no crear un ciclo de imports (session.js ya lo
    // usa para persist.js/backup.js/macros.js más abajo en este archivo).
    const { persistSlot } = await import('./rutina-logic.js');
    await persistSlot(slotIndex);
  }
  if (!S.draft.unilateralOverride) S.draft.unilateralOverride = {};
  S.draft.unilateralOverride[exId] = nuevo;
  await saveDraft();
  vibrate(8);
  bump();
}

/** Tu peso corporal registrado, o 0 si nunca cargaste uno. Sale del perfil,
    que BodyForm mantiene sincronizado con el último registro de cuerpo. */
export function bodyWeightKg() {
  const w = S.cfg?.profile?.weightKg;
  return typeof w === 'number' && w > 0 ? w : 0;
}

/* Con qué peso arranca un ejercicio del que no hay historial. En los de peso
   corporal (dominadas, fondos, plancha) la carga ES tu cuerpo, así que el
   default sale de tu peso registrado — antes arrancaban en 20 kg como
   cualquier otro, un número que ahí no significa nada. Si nunca cargaste tu
   peso queda en 0 y saveSet te dice qué falta, en vez de inventar uno.

   Si la rutina declara un peso de partida (`ex.pesoInicialKg`, siempre en kg
   — la unidad interna; lb es sólo presentación), ese gana acá y NADA MÁS:
   reemplaza a este default, no a la progresión ni al historial (ver el orden
   en ensureVals). Es "con cuánto arranco esto", no "cuánto levanto siempre":
   si le ganara al historial, la rueda volvería para atrás cada sesión y la
   doble progresión no serviría de nada. Ausente/null = sin declarar, que no
   es lo mismo que 0 — por eso se exige número > 0 y no un simple `||`. */
function pesoInicial(ex) {
  if (typeof ex?.pesoInicialKg === 'number' && ex.pesoInicialKg > 0) return ex.pesoInicialKg;
  if (isBodyweight(ex)) return bodyWeightKg();
  return 20;
}

export function ensureVals(ex) {
  if (!S.hoyVals[ex.id]) {
    const last = lastDataFor(ex);
    /* Doble progresión (lib/progression.js): cuando la regla dice que hoy te
       toca SUBIR el peso, la rueda arranca ya en el peso nuevo y en el piso
       del rango. Es la diferencia entre un consejo y una acción: si el
       consejo dice "subí a 62.5 y volvé a 8" pero la rueda te deja en 60×11,
       el trabajo de moverla —quince veces por sesión— sigue siendo tuyo.
       En los otros dos casos (sumar reps / sostener) el punto de partida
       correcto ES la última serie, así que se deja el comportamiento de
       siempre. */
    const prog = progresion(ex);
    if (prog?.accion === 'subir_peso') S.hoyVals[ex.id] = { w: prog.peso, r: prog.piso, rpe: null };
    else if (last) { const ls = last[last.length - 1]; S.hoyVals[ex.id] = { w: ls.w, r: ls.r, rpe: null }; }
    else S.hoyVals[ex.id] = { w: pesoInicial(ex), r: ex.reps || 10, rpe: null };
  }
  // `rpe` puede faltar en un S.hoyVals guardado antes de que este campo
  // existiera — se completa acá en vez de forzar una migración de datos.
  if (S.hoyVals[ex.id].rpe === undefined) S.hoyVals[ex.id].rpe = null;
  // `side` (izquierda/derecha) sólo importa en unilaterales; en el resto
  // queda en null y saveSet ni lo guarda en el set. En unilaterales arranca
  // en 'left': Enzo siempre empieza por el izquierdo, y dejarlo en null
  // dejaba filas sueltas que no se podían emparejar en pares (D1).
  if (S.hoyVals[ex.id].side === undefined) S.hoyVals[ex.id].side = isUnilateral(ex) ? 'left' : null;
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

/* El turno que eligió "entrenar igual" en un día de descanso. En memoria y
   con fecha: es una decisión de HOY, no cambia la secuencia (eso lo hace
   completeSession, que avanza desde el turno que de verdad se hizo). */
let elegido = null;
export function elegirTurnoHoy(index) { elegido = index == null ? null : { index, fecha: dstr() }; }

/** El turno que muestra Hoy. Con sesión abierta, SIEMPRE el de la sesión:
    en un descanso el puntero sigue en el descanso mientras entrenás otro, y
    leerlo de ahí dejaba la pantalla mirando un turno y la sesión otro
    (ninguna tarjeta quedaba activa). Sin sesión: el elegido en el descanso,
    si lo hay y sigue siendo hoy; si no, el pendiente. */
export function indiceHoy() {
  if (S.draft?.slotId) {
    const i = S.routine.findIndex(s => s.id === S.draft.slotId);
    if (i >= 0) return i;
  }
  if (elegido && elegido.fecha === dstr() && S.routine[S.cfg.seqIndex]?.type === 'rest'
      && S.routine[elegido.index]?.type === 'workout') return elegido.index;
  return S.cfg.seqIndex;
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

/** Series objetivo de HOY, en FILAS (una por lado en unilaterales): las de
    la rutina más las concedidas a mano. Sin las extra el ejercicio se cierra
    solo al llegar al objetivo — que es su diseño ("el objetivo es el
    techo"), pero deja sin salida al día que querés hacer una serie más.

    En unilaterales el objetivo se DUPLICA (D1): la fila sigue siendo un
    lado, pero un 3×12 unilateral son 3 series reales = 6 filas, no 3. Sin
    esto, a la fila 3 el ejercicio se daba por completo habiendo hecho sólo
    1.5 series reales — el bug que reportó Enzo. `isUnilateral(ex)` y no
    `ex.unilateral` a secas: respeta el override de sólo-hoy igual que el
    resto del archivo. */
export function targetSets(ex) {
  const base = (ex?.sets || 0) * (isUnilateral(ex) ? 2 : 1);
  return base + (S.draft?.extraSets?.[ex?.id] || 0);
}

/** Series REALES completadas, para mostrarle a Enzo "Serie N/3" y no
    "Serie N/6": en unilaterales cada serie real son dos filas (un lado cada
    una), así que se cuenta de a pares. Pura y testeable a propósito — la UI
    (ExerciseCarousel.jsx) la llama para no reinventar la cuenta ahí. */
export function seriesCompletas(filas, uni) {
  return uni ? Math.floor(filas / 2) : filas;
}

export function isSkipped(exId) { return !!S.draft?.skipped?.includes(exId); }

/** Progreso de la sesión en SERIES reales (no filas, no ejercicios):
    hechas / objetivo del turno de hoy. `null` cuando no hay nada que medir
    — sin sesión abierta, o con objetivo 0 — para no mostrar un 0% que
    afirme "no avanzaste" cuando en realidad no hay nada que contar (CLAUDE.md,
    criterio de producto).

    Dos trampas ya resueltas para quien toque esto:
    - `targetSets(ex)` cuenta FILAS (el doble en unilateral) — el objetivo acá
      usa `ex.sets`, la cifra real de series, para no pesar doble un
      unilateral.
    - Los salteados (`S.draft.skipped`) salen del denominador: si no, el
      100% se vuelve inalcanzable en cuanto saltás un ejercicio, y saltar es
      una decisión legítima de la sesión, no un fracaso que deba bajar el
      número. Lo hecho en un ejercicio salteado (si llegaste a registrar algo
      antes de saltarlo) tampoco entra: ni al numerador ni al denominador,
      para que la fracción siga siendo "de lo que me propuse hacer hoy". */
export function sessionProgress(exs) {
  if (!S.draft || !Array.isArray(exs)) return null;
  let done = 0;
  let total = 0;
  for (const ex of exs) {
    if (isSkipped(ex.id)) continue;
    const uni = isUnilateral(ex);
    const filas = setsDone(ex.id).length;
    done += seriesCompletas(filas, uni);
    total += ex.sets || 0;
  }
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(1, done / total));
  return { done, total, pct };
}

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
  if (S.draft.cur === exId) S.draft.cur = siguienteActivo();
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
  /* Pedir una serie más REACTIVA esa tarjeta, siempre — no sólo cuando no
     había ninguna abierta. Antes era `if (!S.draft.cur)`, y eso dejaba el
     caso real: terminás Back extension, la app pasa sola a Hamstring curl,
     te acordás de que te faltaba una, volvés con el carrusel y tocás "una
     serie más" — el objetivo subía en Back extension pero el ejercicio en
     curso seguía siendo Hamstring curl, así que la serie se registraba en la
     tarjeta equivocada (Enzo, sesión en vivo). Pedir una serie más ES decir
     "vuelvo a este": el que estaba abierto se cierra y queda en espera, en su
     lugar de la secuencia, esperando su turno de nuevo. */
  S.draft.cur = exId;
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
  if (!(v.w > 0) && isBodyweight(ex)) {
    // Ejercicio de peso corporal sin peso: no es que el usuario haya puesto un
    // número malo, es que la app todavía no sabe cuánto pesa. Se lo dice en vez
    // de repetir "Peso y reps deben ser > 0", que ahí no explica nada.
    toast('Registrá tu peso corporal en Progreso para usar este ejercicio');
    return;
  }
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
  /* Con la rutina ya empezada, el siguiente se ACTIVA solo (2026-09-24, Enzo:
     "iniciar ejercicio" en cada máquina sobraba — se empieza la rutina una
     vez). Si la máquina está ocupada, "Hacer después" lo manda al final. */
  if (finished) S.draft.cur = nxt ? nxt.id : null;
  await saveDraft();
  vibrate(finished ? [25, 60, 25] : 15);
  bump();
  /* Descanso partido (D2): en unilateral, fila IMPAR es "acabo de hacer un
     lado" → descanso corto (cfg.restSide, 20s por defecto) para que Enzo
     pueda pasar al otro brazo/pierna sin esperar el descanso completo. Fila
     PAR es "cerré la serie de los dos lados" → descanso normal. En
     bilateral no cambia nada: siempre es el descanso normal, como siempre. */
  if (uni && cur.length % 2 === 1) startRest(S.cfg.restSide);
  else {
    startRest();
    /* Y recién acá se pregunta el RIR. Antes se pedía ANTES de confirmar,
       adentro del <details> "Más opciones": nadie abre un acordeón con el
       pulso a 150, así que el dato no llegaba nunca. Invertido el orden —
       primero confirmás, después contestás mientras descansás— la pregunta
       aparece sin que la busques y no le cuesta un solo toque al core loop.

       En unilateral sólo en la fila PAR: la impar es la pausa corta de 20s
       para pasar al otro brazo, la serie todavía no cerró y preguntarle el
       RIR a medio brazo es ruido. El índice apunta a la fila recién
       empujada (cur.length - 1), que es la que va a recibir el `rpe`. */
    /* El esquema va sobre SERIES REALES, no sobre filas: `techo` (targetSets)
       cuenta filas y en unilateral son el doble. Con filas, un 4×10
       unilateral armaba rirScheme(8) = 7/6/5/4/3/2/1/0 y la pregunta del
       descanso decía "pedía RIR 6" — un número que no existe entre los chips
       (0/1/2/3/4+). El índice es el de la serie que ACABA de cerrarse:
       seriesCompletas(cur.length, uni) - 1. En bilateral seriesCompletas()
       es la identidad, así que sigue siendo cur.length - 1, exactamente lo
       de antes. Esta cuenta tiene que dar igual que la de la tarjeta
       (ExerciseCarousel.jsx) o la prescripción y la pregunta se contradicen. */
    const techoSeries = seriesCompletas(techo, uni);
    pedirRir({
      exId,
      setIdx: cur.length - 1,
      pedia: rirPedido(rirScheme(techoSeries, ex.name), seriesCompletas(cur.length, uni) - 1),
    });
  }
  if (finished) {
    toast(nxt ? `✓ ${ex.name} completo · sigue ${nxt.name}` : `✓ ${ex.name} completo · terminaste el día`);
    /* Acá había un scrollCarouselTo(): ya no. `S.draft.cur = null` + bump()
       hacen que ExerciseCarousel se entere solo de que cambió el ejercicio
       en curso y centre el que sigue. Tener las dos cosas era tener DOS
       scrolls suaves compitiendo por la misma transición, y ése era el bug
       de "la tarjeta queda desalineada al pasar de ejercicio" — ver el
       comentario de cabecera de lib/carousel.js con los números medidos. */
  } else {
    const seriesReales = seriesCompletas(cur.length, uni);
    const target = Math.ceil(techo / (uni ? 2 : 1));
    // En unilateral, decir qué lado sigue en vez de mentir con "N/6" — lo
    // que Enzo cuenta en el gimnasio es la serie, no el brazo (D1).
    const msg = uni
      ? `Serie ${seriesReales}/${target}: ${wBoth(v.w)} × ${v.r} · sigue ${v.side === 'left' ? 'izquierda' : 'derecha'}`
      : `Serie ${cur.length}/${target}: ${wBoth(v.w)} × ${v.r}`;
    toast(msg);
  }
}

/** Escribe el RIR sobre la serie YA GUARDADA, la que disparó este descanso.

    Es un parche a posteriori y no un dato que se junta antes de confirmar:
    la serie ya está en el draft con `rpe: null` desde que tocaste "Terminé".
    Por eso no toca "la última serie" a secas sino la fila exacta que anotó
    pedirRir() — entre medio podés haber cambiado de ejercicio, completado el
    que estaba, o descartado el borrador, y en cualquiera de esos casos la
    respuesta no tiene dónde ir y no se escribe nada.

    `rir` en null des-selecciona (el `rpe` vuelve a null): contestar mal y
    corregirlo tiene que ser tan barato como contestar. Devuelve si escribió,
    para que los tests puedan distinguir "no hizo nada" de "guardó". */
export async function setRirUltimaSerie(rir) {
  const p = T.rir;
  if (!p) return false;
  const sets = S.draft?.entries?.[p.exId]?.sets;
  const set = sets && sets[p.setIdx];
  if (!set) return false;
  set.rpe = rir == null ? null : rpeFromRir(rir);
  marcarRirElegido(rir);
  await saveDraft();
  bump();
  return true;
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

  /* El día que se guarda es el día en que DE VERDAD entrenaste (la primera
     serie), no el día en que se abrió el borrador. Una PWA no se cierra, se
     suspende: un borrador abierto anoche —o abierto el martes y completado el
     jueves— quedaba archivado con la fecha vieja, así que la sesión aparecía
     en el día equivocado del historial, de la racha y del volumen semanal
     (Enzo: "la rutina en vivo no registra bien qué día se está realizando").
     Mismo problema que ya tuvo S.nutriDate y por la misma causa. */
  const fecha = dstr(new Date(startAt));
  const sess = {
    id: d.id, date: fecha, slotId: d.slotId, dayName: d.dayName,
    start: startAt, end: Date.now(), duration: Math.max(1, Math.round((Date.now() - startAt) / 60000)), entries,
    ...(skipped.length ? { skipped } : {}),
    ...(added.length ? { added } : {}),
    ...(d.preworkout ? { preworkout: d.preworkout } : {}),
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

  /* Respaldo automático — la otra mitad del arreglo del 2026-09-17.
     `persist()` evita que el SISTEMA borre los datos, pero no que los borres
     vos, ni que se pierda el teléfono. El JSON exportado vive en Descargas,
     fuera del almacenamiento que el navegador puede desalojar, y es lo único
     que sobrevive a todo.

     Va acá, al cerrar una sesión, y no en un temporizador: una PWA no corre
     en segundo plano, así que "cada domingo" nunca se ejecutaría. Y cerrar
     la sesión es un toque de botón, que es la activación que el navegador
     exige para dejar bajar un archivo sin bloquearlo.

     Después del bump() y sin await a propósito: la pantalla de resumen tiene
     que aparecer ya. Y en try/catch —igual que el TDEE en loadAll()— porque
     un respaldo que falla no puede llevarse puesto el cierre de un
     entrenamiento que YA está guardado en disco. */
  try {
    const { tocaAutoBackup } = await import('./persist.js');
    const { enModoPrueba } = await import('./modoPrueba.js');
    // Un respaldo de la copia de prueba en Descargas se confundiría con uno
    // de verdad: en modo prueba no se baja nada.
    if (!enModoPrueba() && tocaAutoBackup(S.cfg, S.sessions.length)) {
      const { exportJSON } = await import('./backup.js');
      await exportJSON({ auto: true });
    }
  } catch (e) {
    console.error('[FIERRO] no se pudo hacer el respaldo automático:', e);
  }
}

/** Abre el borrador de sesión (weekday `wd`, con el orden ya reacomodado si
    hubo drag-to-reorder antes de arrancar). El cronómetro NO arranca acá —
    arranca en startExercise(), cuando de verdad estás en la máquina. */
export async function startSession(index, precheckAdjust = 0, { preworkout = null } = {}) {
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
    // Qué comiste antes ('nada' | 'liviano' | 'comida'), opcional. Se guarda
    // con la sesión para poder cruzarlo después con cómo te fue.
    preworkout,
  };
  await saveDraft();
  closeSheet();
  vibrate(15);
  bump();
}

/** El ejercicio que se activa cuando el actual se cierra (completo, saltado o
    mandado al final): el próximo pendiente, pero sólo si la rutina ya
    arrancó. Antes de "Empezar rutina" no se activa nada solo. */
function siguienteActivo() {
  if (!S.draft?.start) return null;
  const exs = sessionExs(S.routine.findIndex(s => s.id === S.draft.slotId));
  return nextPending(exs)?.id ?? null;
}

/** La rampa de aproximación de este ejercicio quedó hecha: se marca su
    BLOQUE (superior/inferior) como calentado en el borrador — así sobrevive a
    cerrar la app en el medio, que es justo cuando pasa — y arranca el
    descanso largo antes de la primera serie de trabajo. */
export async function marcarCalentado(ex, conDescanso = true) {
  if (!S.draft || !ex) return;
  const bloque = bloqueDe(ex);
  if (bloque) {
    if (!Array.isArray(S.draft.warmBlocks)) S.draft.warmBlocks = [];
    if (!S.draft.warmBlocks.includes(bloque)) S.draft.warmBlocks.push(bloque);
  }
  await saveDraft();
  bump();
  if (conDescanso) startRest(DESCANSO);
}

/** "Hacer después": la máquina está ocupada, así que el ejercicio pasa al
    final de la sesión, sigue pendiente, y se activa el siguiente. No es
    saltarlo — saltar es no hacerlo. */
export async function hacerDespues(exId) {
  if (!S.draft) return;
  const index = S.routine.findIndex(s => s.id === S.draft.slotId);
  const ids = sessionExs(index).map(e => e.id).filter(id => id !== exId);
  ids.push(exId);
  S.draft.order = ids;
  const eraActual = S.draft.cur === exId;
  if (eraActual) S.draft.cur = siguienteActivo();
  await saveDraft();
  vibrate(15);
  bump();
  const ex = findEx(exId);
  const sig = S.draft.cur && S.draft.cur !== exId ? findEx(S.draft.cur) : null;
  toast(sig ? `${ex?.name || 'Ejercicio'} al final · sigue ${sig.name}` : `${ex?.name || 'Ejercicio'} pasa al final`);
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
  // Sin scrollCarouselTo() acá tampoco: S.draft.cur ya cambió, y centrar el
  // slide es trabajo de ExerciseCarousel (único dueño del scroll).
  toast(first ? `⏱ Rutina en marcha · ${ex.name}` : `${ex.name} · serie 1 de ${ex.sets}`);
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

/** Marca un día pasado como entrenado, con uno de los turnos ya configurados.

    El caso real (Enzo, 2026-09-10): entrenó el martes y el jueves, pero el
    martes no lo anotó — y la app no tiene forma de enterarse. Sin esto, ese
    día queda como descanso para siempre: rompe la racha, no cuenta para el
    volumen semanal y el puntero de la secuencia se queda atrás.

    LO QUE NO HACE: no inventa las series. La sesión se guarda con `entries`
    vacío y `retro: true`, o sea "este día entrenaste esto, no sabemos con qué
    pesos". Es exactamente la distinción que el resto de la app ya respeta —
    un alimento sin micros cuenta como "sin dato", nunca como 0. Rellenar los
    pesos con los de la última vez sería inventar un historial que después
    alimentaría los PRs, la progresión y el tonelaje como si fuera medido.

    Tampoco pone duración: `null` es "no se sabe", que es la verdad. */
export async function registrarDiaEntrenado(dateStr, slotId) {
  if (!dateStr || dateStr > dstr()) return null;          // el futuro no se registra
  const slot = S.routine.find(s => s.id === slotId);
  if (!slot) return null;
  if (S.sessions.some(s => s.date === dateStr && s.slotId === slotId)) {
    toast('Ese turno ya está registrado ese día');
    return null;
  }
  /* El mediodía y no las 00:00: una fecha suelta interpretada como medianoche
     UTC se corre un día entero en husos negativos como el de Lima, que es el
     bug de fechas más viejo del mundo. El resto del archivo ya usa 'T12:00:00'
     por lo mismo. */
  const t = new Date(dateStr + 'T12:00:00').getTime();
  const sess = {
    id: uid(), date: dateStr, slotId, dayName: slot.name || 'Entrenamiento',
    start: t, end: t, duration: null, entries: [], retro: true,
  };
  await idb.put('sessions', sess);
  S.sessions.unshift(sess);
  // S.sessions se lee en todos lados asumiendo orden descendente por fecha.
  // Una sesión retroactiva entra en el medio, no arriba.
  S.sessions.sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));

  /* El puntero sólo avanza si esta sesión es la MÁS RECIENTE. Registrar el
     martes después de haber hecho el jueves no puede hacer retroceder la
     secuencia al turno siguiente del martes: eso te haría repetir un turno que
     ya hiciste. */
  const masReciente = S.sessions.every(s => s.date <= dateStr);
  if (masReciente) {
    const at = S.routine.findIndex(s => s.id === slotId);
    if (at >= 0) {
      S.cfg.seqIndex = (at + 1) % Math.max(1, S.routine.length);
      S.cfg.seqIndexDate = dateStr;
      await saveCfg();
    }
  }
  vibrate(15);
  bump();
  toast(`Anotado: ${sess.dayName} el ${fmtD(dateStr)}`);
  return sess;
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
