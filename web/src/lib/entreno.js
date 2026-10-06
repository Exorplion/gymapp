// Lecturas de la pestaña Entreno rehecha (2026-10-06, opción A "el riel del
// ciclo"). Puras sobre S salvo moverTurno, que persiste vía applyWorkoutOrder.
//
// Enzo: "cuando vas a la pestaña de entreno deberías ver cuál es tu rutina,
// tener la opción de editarla, tus rutinas, tus gimnasios… y debajo veo todas
// las tarjetas por los días 1 a 7, incluyendo los de descanso. Siento que es
// toda una pantalla de scrolleo". Ahora se ve UN turno por vez, con sus
// ejercicios abiertos, y el ciclo entero en una línea.
import { S } from './state.js';
import { zonasDeEjercicio, ZONAS } from './recuperacion.js';
import { coberturaDe } from './coverage.js';
import { catOf, stalestGroups } from './muscle.js';
import { applyWorkoutOrder } from './rutina-logic.js';

const DIA = 86400000;
export const esTurno = s => s?.type === 'workout';

/** Índices (en S.routine) de los turnos de entrenamiento, en orden. */
export const indicesDeTurnos = (rutina = S.routine) =>
  rutina.map((s, i) => (esTurno(s) ? i : -1)).filter(i => i >= 0);

/** El turno que se muestra al llegar: el que te toca (el pendiente, o el
    primero de entrenamiento después de un descanso), o el primero. */
export function turnoQueToca(rutina = S.routine, seq = S.cfg.seqIndex || 0) {
  const n = rutina.length;
  for (let k = 0; k < n; k++) {
    const i = (seq + k) % n;
    if (esTurno(rutina[i])) return i;
  }
  return -1;
}

/** El índice seleccionado: S.rutOpen si apunta a un turno de entrenamiento,
    si no el que toca. -1 sin turnos. */
export function turnoElegido(rutina = S.routine) {
  const o = S.rutOpen;
  if (o != null && esTurno(rutina[o])) return o;
  return turnoQueToca(rutina);
}

/** Si el pendiente es este turno: 'hoy' cuando el puntero está en él,
    'sigue' cuando el puntero está en un descanso justo antes. */
export function marcaDeTurno(i, rutina = S.routine, seq = S.cfg.seqIndex || 0) {
  if (!esTurno(rutina[i])) return null;
  if (i === seq) return 'hoy';
  if (!esTurno(rutina[seq]) && turnoQueToca(rutina, seq) === i) return 'sigue';
  return null;
}

/** Series que el turno le da a cada zona del cuerpo, de mayor a menor. Una
    serie de un ejercicio que trabaja dos zonas cuenta para las dos, como en
    recuperacion.js. */
export function seriesPorZonaDeTurno(slot) {
  const m = new Map();
  for (const ex of slot?.exercises || []) {
    for (const z of zonasDeEjercicio(ex)) m.set(z, (m.get(z) || 0) + (ex.sets || 0));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || ZONAS.indexOf(a[0]) - ZONAS.indexOf(b[0]));
}

/** Series a la semana que da el PLAN a cada zona. Si el ciclo no dura 7
    turnos se lleva a 7 días (`factor`), y se dice: la franja 10–20 es por
    semana, no por ciclo. Sólo zonas que la rutina entrena. */
export function seriesSemanaDelPlan(rutina = S.routine) {
  const n = rutina.length;
  const total = new Map();
  rutina.filter(esTurno).forEach(s => seriesPorZonaDeTurno(s).forEach(([z, v]) => total.set(z, (total.get(z) || 0) + v)));
  const factor = n && n !== 7 ? 7 / n : 1;
  const filas = [...total.entries()]
    .map(([zona, v]) => ({ zona, series: Math.round(v * factor) }))
    .sort((a, b) => b.series - a.series || ZONAS.indexOf(a.zona) - ZONAS.indexOf(b.zona));
  const sinEntrenar = ZONAS.filter(z => !total.has(z));
  return { filas, factor, dias: n, sinEntrenar };
}

/** Porciones de cada grupo que ningún ejercicio de la rutina toca (lo que
    antes era la tarjeta "Porciones que tu rutina todavía no toca"). Sólo
    grupos con evidencia de porciones (coberturaDe ≠ null) y con algo ya
    cubierto: sugerir un músculo que no entrenás sería inventar un problema. */
export function huecosDeCobertura(rutina = S.routine) {
  const porGrupo = new Map();
  rutina.forEach(slot => (slot.exercises || []).forEach(ex => {
    const cat = catOf(ex);
    if (!cat) return;
    if (!porGrupo.has(cat)) porGrupo.set(cat, []);
    porGrupo.get(cat).push(ex.name);
  }));
  return [...porGrupo.entries()]
    .map(([cat, nombres]) => ({ cat, cob: coberturaDe(cat, nombres) }))
    .filter(x => x.cob && x.cob.faltan.length && x.cob.cubiertas.length)
    .map(x => ({ cat: x.cat, faltan: x.cob.faltan }));
}

/** Grupos sin entrenar hace 10+ días (lo que era "Se está enfriando"). */
export const enfriandose = () => stalestGroups(10);

/** Minutos que suele llevar el turno: la última vez que lo hiciste, o ~3
    min por serie si nunca (mismo cálculo que la portada). */
export function minutosDeTurno(slot, sesiones = S.sessions) {
  const ult = sesiones.find(s => s.slotId === slot.id && s.duration);
  if (ult) return Math.round(ult.duration / 5) * 5;
  return Math.round(((slot.exercises || []).reduce((a, e) => a + (e.sets || 0), 0) * 3) / 5) * 5;
}

/** Fecha ('YYYY-MM-DD') de la última vez que hiciste ese turno, o null. */
export function ultimaVezDeTurno(slot, sesiones = S.sessions) {
  let mejor = null;
  for (const s of sesiones) if (s.slotId === slot.id && s.date && (!mejor || s.date > mejor)) mejor = s.date;
  return mejor;
}

const clave = n => String(n || '').trim().toLowerCase();

/** El peso más alto que levantaste en un ejercicio, sesión por sesión, de la
    más nueva a la más vieja: [{ fecha, kg }]. Por nombre (no por id): el
    mismo ejercicio en Anterior A y Anterior B tiene ids distintos. */
export function historialDePeso(nombre, sesiones = S.sessions) {
  const k = clave(nombre);
  const out = [];
  for (const s of sesiones) {
    for (const e of s.entries || []) {
      if (clave(e.name) !== k) continue;
      const kg = Math.max(0, ...(e.sets || []).map(x => x.w || 0));
      if (kg > 0 && s.date) out.push({ fecha: s.date, kg });
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Último peso y cuánto cambió contra la sesión más nueva de hace 3+
    semanas: { kg, delta, semanas } — delta/semanas null sin una sesión tan
    vieja (no se inventa una tendencia con dos semanas de datos). null si
    nunca lo registraste. */
export function progresoDeEjercicio(nombre, sesiones = S.sessions) {
  const h = historialDePeso(nombre, sesiones);
  if (!h.length) return null;
  const ult = h[0];
  const t0 = new Date(ult.fecha + 'T12:00:00').getTime();
  const viejo = h.find(x => t0 - new Date(x.fecha + 'T12:00:00').getTime() >= 21 * DIA);
  if (!viejo) return { kg: ult.kg, delta: null, semanas: null };
  const semanas = Math.round((t0 - new Date(viejo.fecha + 'T12:00:00').getTime()) / (7 * DIA));
  return { kg: ult.kg, delta: Math.round((ult.kg - viejo.kg) * 10) / 10, semanas };
}

/** En qué turnos aparece un ejercicio (por nombre), en orden. */
export function turnosDeEjercicio(nombre, rutina = S.routine) {
  const k = clave(nombre);
  return rutina.filter(s => esTurno(s) && (s.exercises || []).some(e => clave(e.name) === k));
}

/** Corre un turno de entrenamiento un lugar antes (-1) o después (+1) en la
    secuencia; los descansos se recalculan solos (applyWorkoutOrder). Devuelve
    el índice nuevo del turno, o null si no se movió. */
export async function moverTurno(id, dir) {
  const ids = S.routine.filter(esTurno).map(s => s.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await applyWorkoutOrder(ids);
  return S.routine.findIndex(s => s.id === id);
}

