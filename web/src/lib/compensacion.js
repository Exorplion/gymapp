// Recomendar cómo cerrar la semana (turnos universales, Fase 4; spec
// 2026-10-12, §6). Enzo eligió la opción A: si hacés algo fuera del plan, la
// semana sigue y la app te PROPONE compensar, sólo con ejercicios que ya
// están en tu rutina. Vos decidís si lo tomás; aceptar toca sólo la sesión de
// ese día, nunca la rutina.
//
// Ejemplo (el de la spec): A·P·R·A·P·R·R. El martes tocaba Posterior y fue
// "Pull con Juan". El jueves (Anterior) te propone traer Elevación de gemelos
// de Posterior; el viernes (Posterior), +2 Curl femoral y +2 Hip thrust. Lo
// que no entra se dice una vez y vence con la semana.
//
// Puro: recibe la rutina, las sesiones, el puntero y la recuperación.
import { ZONAS, zonasDeEjercicio, seriesPorZona, ventanaHoras } from './recuperacion.js';
import { claveTurno } from './turnos.js';

/** Topes (decisión de Enzo, 2026-10-12: "como están propuestos"). */
export const TOPES = { porSesion: 4, porEjercicio: 2, traidos: 1, seriesTraido: 3, falta: 3 };
/** Por debajo de este % estimado una zona está "cargada" (estadoDe). */
const LISTO_PARA_ENTRENAR = 60;
const HORAS_POR_SLOT = 24;   // "un slot = un día", como weekdayProjection
const RIR_SUPUESTO = 2;

const esTurno = s => s?.type === 'workout';
const nombreClave = n => String(n || '').trim().toLowerCase();

/** 'YYYY-MM-DD' + n días (al mediodía: el horario de verano no corre la fecha). */
export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Series por zona del plan de un turno (una serie de un ejercicio de dos
    zonas cuenta para las dos, como seriesPorZonaDeTurno). */
function planPorZona(slot) {
  const out = {};
  for (const ex of slot?.exercises || []) {
    for (const z of zonasDeEjercicio(ex)) out[z] = (out[z] || 0) + (ex.sets || 0);
  }
  return out;
}

/** ¿La sesión `s` trabajó la zona? (alguna serie de un ejercicio de esa zona) */
const trabajo = (hecho, z) => (hecho[z] || 0) > 0;

/** El turno de una parada guardada en una sesión (por id de slot; si ya no
    existe, por id de turno). */
function slotDe(routine, slotId, turnoId) {
  return routine.find(s => s.id === slotId)
    || (turnoId ? routine.find(s => esTurno(s) && claveTurno(s) === turnoId) : null)
    || null;
}

/**
 * Lo que quedó sin hacer en el ciclo actual por las sesiones fuera del plan.
 *
 * Devuelve null si no hay nada que compensar, o:
 * { origen: [...], faltas: { [zona]: series }, perdida: Set(zonas que bajaron
 *   de 2+ a 1 vez en el ciclo), plan: { [zona]: veces planeadas }, real }
 */
export function faltasDelCiclo({ routine, sessions, seqIndex, ciclo = 0 }) {
  if (!(seqIndex >= 0 && seqIndex < routine.length)) return null;
  const origenes = (sessions || [])
    .filter(s => s.fueraDePlan && s.reemplaza && (s.reemplaza.ciclo || 0) === ciclo)
    .map(s => ({ s, slot: slotDe(routine, s.reemplaza.slotId, s.reemplaza.turnoId) }))
    .filter(o => esTurno(o.slot))
    .sort((a, b) => (a.s.start || 0) - (b.s.start || 0));
  if (!origenes.length) return null;

  const despuesDe = (s, o) => s.id !== o.id && (s.date > o.date || (s.date === o.date && (s.start || 0) > (o.start || 0)));
  const faltas = {};
  for (const { s: o, slot } of origenes) {
    const plan = planPorZona(slot);
    const hecho = seriesPorZona([o], o.date);
    const falta = {};
    for (const z of Object.keys(plan)) if (plan[z] > hecho[z]) falta[z] = plan[z] - hecho[z];
    // Menos lo ya compensado: lo que las sesiones de después hicieron por
    // ENCIMA de su propio plan en esa zona (la serie extra del jueves).
    for (const s of sessions) {
      if (!despuesDe(s, o)) continue;
      const suPlan = s.fueraDePlan
        ? planPorZona(s.reemplaza ? slotDe(routine, s.reemplaza.slotId, s.reemplaza.turnoId) : null)
        : planPorZona(slotDe(routine, s.slotId, s.turnoId));
      const suHecho = seriesPorZona([s], s.date);
      for (const z of Object.keys(falta)) {
        const extra = suHecho[z] - (suPlan[z] || 0);
        if (extra > 0) falta[z] = Math.max(0, falta[z] - extra);
      }
    }
    for (const [z, v] of Object.entries(falta)) if (v > 0) faltas[z] = (faltas[z] || 0) + v;
  }

  // Frecuencia por zona: veces que el ciclo planeaba trabajarla contra las
  // que va a quedar trabajada (lo planeado antes de la primera sesión fuera
  // del plan + lo que de verdad se hizo desde ahí + lo que queda desde hoy).
  const primera = origenes[0].s;
  const iPrimera = routine.findIndex(x => x.id === origenes[0].slot.id);
  const planVeces = {}, realVeces = {};
  routine.forEach((slot, i) => {
    if (!esTurno(slot)) return;
    const p = planPorZona(slot);
    for (const z of Object.keys(p)) {
      planVeces[z] = (planVeces[z] || 0) + 1;
      if ((iPrimera >= 0 && i < iPrimera) || i >= seqIndex) realVeces[z] = (realVeces[z] || 0) + 1;
    }
  });
  for (const s of sessions) {
    if (s.id !== primera.id && !despuesDe(s, primera)) continue;
    const h = seriesPorZona([s], s.date);
    for (const z of ZONAS) if (trabajo(h, z)) realVeces[z] = (realVeces[z] || 0) + 1;
  }
  const perdida = new Set(ZONAS.filter(z => (planVeces[z] || 0) >= 2 && (realVeces[z] || 0) <= 1 && (faltas[z] || 0) > 0));

  return { origen: origenes.map(o => o.s), faltas, perdida, planVeces, realVeces };
}

/** Las zonas con falta, en orden: las que perdieron frecuencia, después las
    de más series, después el orden del cuerpo. */
function zonasConFalta(faltas, perdida) {
  return ZONAS
    .filter(z => (faltas[z] || 0) >= TOPES.falta || (perdida.has(z) && (faltas[z] || 0) > 0))
    .sort((a, b) => (perdida.has(b) - perdida.has(a)) || (faltas[b] - faltas[a]) || (ZONAS.indexOf(a) - ZONAS.indexOf(b)));
}

/** Desempate entre ejercicios candidatos para una zona: el más específico
    (menos zonas), después el de MENOS series planeadas (sumar a un curl
    femoral de 3 antes que a un peso muerto de 4: es lo más liviano de sumar,
    y es lo que elige el ejemplo de la spec), después el orden del turno. */
const porEspecificidad = (a, b) =>
  zonasDeEjercicio(a.ex).length - zonasDeEjercicio(b.ex).length || (a.ex.sets || 0) - (b.ex.sets || 0) || a.i - b.i;

/**
 * La propuesta para HOY (el turno pendiente, `routine[seqIndex]`, antes de
 * empezar). `rec` es recuperacion(sesiones, ahora); `fecha` el día de hoy.
 *
 * Devuelve null si no hay nada que decir, o:
 * {
 *   clave: 'ciclo:slotId',          // para "Sumar a hoy" / "Hoy no"
 *   origen: [{ sessionId, fecha, enVezDe, hiciste }],
 *   faltan: [{ zona, series, frecuencia: { plan, real } }],
 *   hoy: [{ id, tipo: 'series', exId, nombre, mas, zona, falta }
 *        | { id, tipo: 'traer', ex: { name, sets, reps, … }, desde, zona, falta }],
 *   despues: [{ zonas, fecha, turno }],   // lo que va otro día de este ciclo
 *   sinLugar: [{ zona, series }],         // lo que no entra este ciclo
 * }
 */
export function compensacion({ routine, sessions, seqIndex, ciclo = 0, rec = {}, fecha }) {
  const hoySlot = routine[seqIndex];
  if (!esTurno(hoySlot)) return null;
  const base = faltasDelCiclo({ routine, sessions, seqIndex, ciclo });
  if (!base) return null;
  const { faltas, perdida, planVeces, realVeces } = base;
  const zonas = zonasConFalta(faltas, perdida);
  if (!zonas.length) return null;

  const falta = { ...faltas };
  const planHoy = planPorZona(hoySlot);
  const sumadoZona = {};
  const hoy = [];
  let total = 0, traidos = 0;
  const masPorEj = {};

  // Horas hasta el próximo slot del ciclo que planea la zona, o null.
  const proximo = z => {
    for (let k = seqIndex + 1; k < routine.length; k++) {
      if (esTurno(routine[k]) && planPorZona(routine[k])[z]) return k;
    }
    return null;
  };
  // ¿Se puede cargar la zona hoy con `extra` series más?
  const recupera = (z, extra) => {
    if (rec[z] && rec[z].pct < LISTO_PARA_ENTRENAR) return false;   // cargada ahora
    const k = proximo(z);
    if (k == null) return true;
    const horas = (k - seqIndex) * HORAS_POR_SLOT;
    const series = (planHoy[z] || 0) + (sumadoZona[z] || 0) + extra;
    return (horas / ventanaHoras(z, series, RIR_SUPUESTO)) * 100 >= LISTO_PARA_ENTRENAR;
  };
  const recuperaTodo = (ex, extra) => zonasDeEjercicio(ex).every(z => recupera(z, extra));
  const aplicar = (ex, mas) => {
    for (const z of zonasDeEjercicio(ex)) {
      sumadoZona[z] = (sumadoZona[z] || 0) + mas;
      if (falta[z]) falta[z] = Math.max(0, falta[z] - mas);
    }
    total += mas;
  };

  const enHoy = new Set((hoySlot.exercises || []).map(e => nombreClave(e.name)));
  const reemplazos = base.origen.map(o => ({ o, slot: slotDe(routine, o.reemplaza.slotId, o.reemplaza.turnoId) }));

  const probarSeries = z => {
    const cands = (hoySlot.exercises || [])
      .map((ex, i) => ({ ex, i }))
      .filter(c => zonasDeEjercicio(c.ex).includes(z) && (masPorEj[c.ex.id] || 0) < TOPES.porEjercicio)
      .sort(porEspecificidad);
    for (const { ex } of cands) {
      const mas = Math.min(TOPES.porEjercicio - (masPorEj[ex.id] || 0), falta[z], TOPES.porSesion - total);
      if (mas <= 0 || !recuperaTodo(ex, mas)) continue;
      masPorEj[ex.id] = (masPorEj[ex.id] || 0) + mas;
      const ya = hoy.find(h => h.tipo === 'series' && h.exId === ex.id);
      const f = falta[z];
      aplicar(ex, mas);
      if (ya) ya.mas += mas;
      else hoy.push({ id: `s:${ex.id}`, tipo: 'series', exId: ex.id, nombre: ex.name, mas, zona: z, falta: f });
      return true;
    }
    return false;
  };
  const probarTraer = z => {
    if (traidos >= TOPES.traidos) return false;
    for (const { o, slot } of reemplazos) {
      if (!planPorZona(slot)[z] || seriesPorZona([o], o.date)[z] >= planPorZona(slot)[z]) continue;
      const cands = (slot.exercises || [])
        .map((ex, i) => ({ ex, i }))
        .filter(c => zonasDeEjercicio(c.ex).includes(z) && !enHoy.has(nombreClave(c.ex.name)))
        .sort(porEspecificidad);
      for (const { ex } of cands) {
        const series = Math.min(ex.sets || 0, falta[z], TOPES.seriesTraido, TOPES.porSesion - total);
        if (series <= 0 || !recuperaTodo(ex, series)) continue;
        const f = falta[z];
        aplicar(ex, series);
        traidos += 1;
        hoy.push({
          id: `t:${ex.id}`, tipo: 'traer', zona: z, falta: f, desde: slot.name || '',
          ex: {
            name: ex.name, sets: series, reps: ex.reps,
            ...(ex.equip ? { equip: ex.equip } : {}), ...(ex.machine ? { machine: ex.machine } : {}),
            ...(ex.unilateral ? { unilateral: true } : {}), ...(ex.cat ? { cat: ex.cat } : {}),
          },
        });
        return true;
      }
    }
    return false;
  };

  for (const z of zonas) {
    if (total >= TOPES.porSesion) break;
    if (!(falta[z] > 0)) continue;
    const traerPrimero = perdida.has(z) && !planHoy[z];
    if (traerPrimero) { if (!probarTraer(z)) probarSeries(z); }
    else if (!probarSeries(z)) probarTraer(z);
  }

  // Lo que queda: a otro día del ciclo que planee la zona, o sin lugar.
  const quedan = zonas.filter(z => falta[z] >= TOPES.falta || (perdida.has(z) && falta[z] > 0 && !sumadoZona[z]));
  const porSlot = new Map();
  const sinLugar = [];
  for (const z of quedan) {
    const k = proximo(z);
    if (k == null) { if (falta[z] >= TOPES.falta) sinLugar.push({ zona: z, series: falta[z] }); continue; }
    if (!porSlot.has(k)) porSlot.set(k, []);
    porSlot.get(k).push(z);
  }
  const despues = [...porSlot.entries()].sort((a, b) => a[0] - b[0]).map(([k, zs]) => ({
    zonas: zs, fecha: fecha ? sumarDias(fecha, k - seqIndex) : null, turno: routine[k].name || '',
  }));

  return {
    clave: `${ciclo}:${hoySlot.id}`,
    origen: base.origen.map(o => ({ sessionId: o.id, fecha: o.date, enVezDe: o.reemplaza?.nombre || '', hiciste: o.dayName || '' })),
    faltan: zonas.map(z => ({ zona: z, series: faltas[z], frecuencia: { plan: planVeces[z] || 0, real: realVeces[z] || 0 } })),
    hoy, despues, sinLugar,
  };
}

/** Para la línea del resumen al cerrar una sesión fuera del plan: qué zonas
    quedaron con falta y qué días de este ciclo quedan para compensarlas.
    null si no hay nada que decir. */
export function avisoAlCerrar({ routine, sessions, seqIndex, ciclo = 0, fecha }) {
  const base = faltasDelCiclo({ routine, sessions, seqIndex, ciclo });
  if (!base) return null;
  const zonas = zonasConFalta(base.faltas, base.perdida);
  if (!zonas.length) return null;
  // Todo día de entrenamiento que queda en el ciclo puede proponer algo
  // (series o traer): qué, lo decide la recuperación de ese día.
  const dias = [];
  for (let k = seqIndex; k < routine.length; k++) {
    if (esTurno(routine[k])) dias.push(fecha ? sumarDias(fecha, k - seqIndex) : null);
  }
  if (!dias.length) return null;
  return { zonas, dias };
}

/* ---------- textos (los usan la tarjeta de Hoy y el resumen) ---------- */

/** "martes", "viernes"… de una fecha 'YYYY-MM-DD'. */
export const diaLargo = fecha => new Date(fecha + 'T12:00:00').toLocaleDateString('es', { weekday: 'long' });

/** "femoral, glúteo y gemelos" (en minúscula, con "y" al final). Con más
    de `max`, "femoral, glúteo, gemelos y 2 más". */
export function listaZonas(zonas, max = 99) {
  const zs = zonas.map(z => z.toLowerCase());
  if (zs.length > max) return `${zs.slice(0, max).join(', ')} y ${zs.length - max} más`;
  return zs.length < 2 ? zs.join('') : `${zs.slice(0, -1).join(', ')} y ${zs[zs.length - 1]}`;
}

/** "El jueves y el viernes" / "El viernes". */
export function listaDias(fechas) {
  const ds = [...new Set(fechas)].map(f => `el ${diaLargo(f)}`);
  const t = ds.length < 2 ? ds.join('') : `${ds.slice(0, -1).join(', ')} y ${ds[ds.length - 1]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
