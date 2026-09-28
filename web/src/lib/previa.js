// Los datos de la previa del ejercicio (rediseño 2026-09-27, pieza 3): lo
// que se ve debajo de la tarjeta con la sesión abierta y el ejercicio sin
// empezar. Todo sale de funciones que ya existen (charts, muscle,
// objetivoHoy); acá sólo se eligen la ventana y la forma. Criterio de la
// app: sin dato, null — nunca un cero ni una estimación disfrazada de hecho.
import { S, wDisplay } from './state.js';
import { e1rmSeries, trend, exerciseSeries } from './charts.js';
import { objetivoHoy } from './objetivoHoy.js';
import { lastDataFor } from './session.js';
import { catOf, recoveryPct, daysSinceGroup, diasTexto } from './muscle.js';
import { round1, dstr } from './format.js';

const UNI = ' (unilateral)';
/** La ventana del cambio de fuerza: 8 semanas. */
const VENTANA_DIAS = 56;

/** La clave de historial por nombre, la misma que usa Progreso
    (exerciseSeries / e1rmSeries): el unilateral es otra serie. */
const clave = (ex, uni) => String(ex?.name || '').trim() + (uni ? UNI : '');

/** Días entre dos fechas YYYY-MM-DD; el mediodía evita el corrimiento del
    horario de verano (igual que muscle.ts). */
function diasEntre(desde, hasta) {
  return Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);
}

/** "Tu fuerza": el 1RM estimado más reciente y cuánto cambió en las 8
    semanas que terminan en la última sesión. `puntos` es esa ventana, lista
    para la sparkline. El cambio exige dos sesiones separadas por una semana
    o más: con menos, `cambioPct` es null, nunca un "0 %". */
export function fuerzaPrevia(ex, { uni = false } = {}) {
  const pts = e1rmSeries(clave(ex, uni));
  if (!pts.length) return null;
  const ultimo = pts[pts.length - 1];
  const puntos = pts.filter(p => diasEntre(p.date, ultimo.date) <= VENTANA_DIAS);
  const base = puntos[0];
  const tramo = diasEntre(base.date, ultimo.date);
  const hayCambio = puntos.length >= 2 && tramo >= 7 && base.y > 0;
  return {
    actual: round1(ultimo.y),
    cambioPct: hayCambio ? (Math.round(((ultimo.y - base.y) / base.y) * 100) || 0) : null,
    semanas: hayCambio ? Math.max(1, Math.round(tramo / 7)) : null,
    puntos,
    tendencia: trend(puntos),
    fecha: ultimo.date,
  };
}

/** Los puntos de una sparkline para `<polyline points>`, repartidos
    parejo a lo ancho. null con menos de dos puntos; una serie plana va al
    medio en vez de dividir por cero. */
export function sparkPuntos(puntos, { ancho = 96, alto = 38, margen = 3 } = {}) {
  const ys = (puntos || []).map(p => Number(p?.y)).filter(Number.isFinite);
  if (ys.length < 2 || !(ancho > 2 * margen) || !(alto > 2 * margen)) return null;
  const min = Math.min(...ys), max = Math.max(...ys), rango = max - min;
  const w = ancho - 2 * margen, h = alto - 2 * margen;
  const xy = ys.map((y, i) => [
    round1(margen + (i / (ys.length - 1)) * w),
    round1(rango ? margen + (1 - (y - min) / rango) * h : alto / 2),
  ]);
  const [x, y] = xy[xy.length - 1];
  return { points: xy.map(p => p.join(',')).join(' '), ultimo: { x, y } };
}

/** "hace 3 semanas": diasTexto() hasta dos semanas, después semanas y
    meses. Sin un número válido, vacío (la UI no pinta la línea). */
export function haceTexto(dias) {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return '';
  if (dias < 14) return diasTexto(dias);
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

/** "Récord": la mejor serie (peso × reps de mayor volumen) y hace cuánto.
    Mismo criterio y misma clave que "Mejor serie" en Progreso → PRs
    (exerciseSeries), para que los dos números coincidan. En empate cuenta
    la primera vez que se logró. */
export function recordPrevia(ex, { uni = false, hoy = dstr() } = {}) {
  let mejor = null;
  for (const p of exerciseSeries()[clave(ex, uni)] || []) if (!mejor || p.best > mejor.best) mejor = p;
  if (!mejor) return null;
  const dias = Math.max(0, diasEntre(mejor.date, hoy));
  return { w: mejor.w, r: mejor.r, date: mejor.date, dias, hace: haceTexto(dias) };
}

/** "Recuperación" del grupo del ejercicio. `dias` null = el grupo nunca se
    entrenó: recoveryPct() devuelve 100 en ese caso, y la UI tiene que decir
    "sin registro" en vez de afirmar un 100 %. null si el grupo no se
    reconoce. */
export function recuperacionPrevia(ex) {
  const cat = catOf(ex);
  if (!cat) return null;
  return { cat, pct: recoveryPct(cat), dias: daysSinceGroup(cat) };
}

const repsDe = ex => {
  const r = Math.round(Number(ex?.reps));
  return r > 0 ? r : null;
};

/** "Meta de hoy": peso y reps concretos sobre objetivoHoy() (la doble
    progresión, o el sugerido por 1RM). En "sumar reps" la meta es una rep
    más que la mejor de la última vez al peso de trabajo, con techo en el
    tope del rango. La primera vez sin nada con qué calcular no lleva peso,
    salvo el peso de partida que la rutina declare (ex.pesoInicialKg). */
export function metaHoy(ex, { uni = false, ajuste = 0 } = {}) {
  const obj = objetivoHoy(ex, { uni, ajuste });
  const { tipo } = obj;
  if (tipo === 'subir' || tipo === 'sostener') return { tipo, peso: obj.peso, reps: obj.meta, texto: obj.texto };
  if (tipo === 'sumar') {
    const last = lastDataFor(ex) || [];
    const top = Math.max(...last.map(s => s.w));
    const mejores = Math.max(0, ...last.filter(s => s.w >= top - 0.01).map(s => s.r));
    return { tipo, peso: obj.peso, reps: last.length ? Math.min(obj.meta, mejores + 1) : obj.meta, texto: '1 rep más que la última' };
  }
  if (tipo === 'sugerido') return { tipo, peso: obj.peso, reps: repsDe(ex), texto: obj.texto };
  const inicial = typeof ex?.pesoInicialKg === 'number' && ex.pesoInicialKg > 0 ? ex.pesoInicialKg : null;
  return inicial != null
    ? { tipo, peso: inicial, reps: repsDe(ex), texto: 'tu peso de partida' }
    : { tipo, peso: null, reps: repsDe(ex), texto: obj.texto };
}

/** La meta en una línea: "47.5 kg × 8 · 1 rep más que la última". La misma
    línea va en la previa y, después de Empezar, dentro de la tarjeta. */
export function metaTexto(meta) {
  if (!meta) return '';
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const partes = [];
  if (meta.peso != null) partes.push(`${meta.tipo === 'sugerido' ? '~' : ''}${wDisplay(meta.peso)} ${unidad}${meta.reps ? ` × ${meta.reps}` : ''}`);
  else if (meta.reps) partes.push(`${meta.reps} reps`);
  if (meta.texto) partes.push(meta.texto);
  return partes.join(' · ');
}

/** Todo lo que muestra la previa de un ejercicio. `primeraVez` es la misma
    condición que el "Primera vez" de la tarjeta (sin historial con ESTE
    equipo, lastDataFor): en ese caso no hay gráfico ni récord, y el peso
    sugerido por 1RM, si existe, llega en `meta` (tipo 'sugerido'). */
export function previaEjercicio(ex, { uni = false, ajuste = 0, hoy = dstr() } = {}) {
  const primeraVez = !lastDataFor(ex);
  return {
    primeraVez,
    fuerza: primeraVez ? null : fuerzaPrevia(ex, { uni }),
    record: primeraVez ? null : recordPrevia(ex, { uni, hoy }),
    recuperacion: recuperacionPrevia(ex),
    meta: metaHoy(ex, { uni, ajuste }),
  };
}
