// Lecturas de la pestaña Progreso rehecha (2026-10-06).
//
// Enzo: "la mayoría de la pestaña es solo ver el peso, un gráfico, y abajo
// 'tus sesiones' que no se entiende… debería servir un propósito, darle
// valor al usuario, ver ese progreso". La pregunta que contesta ahora la
// pantalla, primero, es "¿estoy más fuerte?", con un número y una curva.
//
// Todo sale del 1RM estimado (Epley, e1rmSeries de charts.ts) de la mejor
// serie de cada sesión: es lo único que compara un 80 × 9 con un 85 × 6.
// Criterio de la app: sin datos suficientes se dice, no se rellena.
import { S } from './state.js';
import { dstr } from './format.js';
import { e1rmSeries, strengthReadout, trend, project } from './charts.js';
import { sessionPRs } from './session.js';

const DIA = 86400000;
const t = fecha => new Date(fecha + 'T12:00:00').getTime();
/** Ya no alcanza con dos sesiones de diferencia: hace falta que entre la base
    y la última haya al menos dos semanas para hablar de "progreso". */
const MIN_DIAS = 14;
/** Cambios de ±1 % son ruido de un día (una rep más o menos). */
const UMBRAL = 0.01;

/** La ventana que se mira: 8 semanas, o desde la primera sesión si hay
    menos historia. { desde, semanas } o null sin sesiones. */
export function ventana(hoy = dstr(), sesiones = S.sessions) {
  const fechas = sesiones.map(s => s.date).filter(Boolean).sort();
  if (!fechas.length) return null;
  const ocho = dstr(new Date(t(hoy) - 56 * DIA));
  const desde = fechas[0] > ocho ? fechas[0] : ocho;
  return { desde, semanas: Math.max(1, Math.round((t(hoy) - t(desde)) / (7 * DIA))) };
}

/** Cada ejercicio con su base (el último 1RM estimado ANTES de la ventana, o
    el primero dentro), el último, y su estado: 'sube' | 'igual' | 'baja', o
    'nuevo' cuando entre base y último no hay dos semanas. */
export function fuerzaPorEjercicio(desde) {
  return strengthReadout().map(x => {
    const pts = x.pts;
    const antes = pts.filter(p => p.date < desde);
    const dentro = pts.filter(p => p.date >= desde);
    if (!dentro.length) return null;
    const base = antes.length ? antes[antes.length - 1] : dentro[0];
    const ult = pts[pts.length - 1];
    const enVentana = antes.length ? [base, ...dentro] : dentro;
    const r = { name: x.name, pts: enVentana, base, ult, t: x.t, delta: Math.round((ult.y - base.y) * 10) / 10, pct: base.y ? ult.y / base.y - 1 : 0 };
    if (t(ult.date) - t(base.date) < MIN_DIAS * DIA) return { ...r, estado: 'nuevo' };
    return { ...r, estado: r.pct >= UMBRAL ? 'sube' : r.pct <= -UMBRAL ? 'baja' : 'igual' };
  }).filter(Boolean);
}

/** El índice de fuerza: en cada día entrenado de la ventana, el promedio de
    (último 1RM estimado hasta ese día ÷ su base) de los ejercicios que ya
    tienen base, × 100. Arranca en 100. Sólo cuentan los que tienen dos
    semanas de datos (no los 'nuevo'), para que un ejercicio que empezaste
    ayer no aplaste la curva. [{ date, y }] */
export function indiceDeFuerza(ejercicios) {
  const validos = ejercicios.filter(e => e.estado !== 'nuevo');
  if (!validos.length) return [];
  const fechas = [...new Set(validos.flatMap(e => e.pts.map(p => p.date)))].sort();
  return fechas.map(f => {
    let suma = 0, n = 0;
    for (const e of validos) {
      if (e.base.date > f) continue;
      let v = e.base.y;
      for (const p of e.pts) if (p.date <= f) v = p.y;
      suma += v / e.base.y; n++;
    }
    return n ? { date: f, y: Math.round((suma / n) * 1000) / 10 } : null;
  }).filter(Boolean);
}

/** El resumen de la ventana: el % del índice, y cuántos suben/igual/bajan. */
export function resumenFuerza(hoy = dstr()) {
  const v = ventana(hoy);
  if (!v) return null;
  const ejercicios = fuerzaPorEjercicio(v.desde);
  const indice = indiceDeFuerza(ejercicios);
  const cuenta = { sube: 0, igual: 0, baja: 0, nuevo: 0 };
  ejercicios.forEach(e => { cuenta[e.estado]++; });
  const pct = indice.length >= 2 ? Math.round((indice[indice.length - 1].y - 100) * 10) / 10 : null;
  return { ...v, ejercicios, indice, cuenta, pct };
}

/** Proyección a 4 semanas de un ejercicio (charts.ts project), o null. */
export const proyeccion = e => project(e.t || trend(e1rmSeries(e.name)), 4);

/** Récords de los últimos `dias`: [{ date, name, w, r }], el más nuevo primero. */
export function recordsRecientes(dias = 30, hoy = dstr(), sesiones = S.sessions) {
  const desde = dstr(new Date(t(hoy) - dias * DIA));
  const out = [];
  for (const s of sesiones) {
    if (!s.date || s.date < desde || !s.start) continue;
    for (const p of sessionPRs(s)) out.push({ date: s.date, name: p.name, w: p.w, r: p.r });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** El mapa de constancia en columnas por semana (lunes arriba): cada columna
    trae 7 días, con relleno 'fuera' antes del primero para alinear. */
export function semanasDeConstancia(dias) {
  if (!dias.length) return [];
  const lunes = d => (new Date(d.date + 'T12:00:00').getDay() + 6) % 7;
  const relleno = Array.from({ length: lunes(dias[0]) }, (_, i) => ({ date: `fuera-${i}`, status: 'fuera' }));
  const todos = [...relleno, ...dias];
  const out = [];
  for (let i = 0; i < todos.length; i += 7) out.push(todos.slice(i, i + 7));
  return out;
}
