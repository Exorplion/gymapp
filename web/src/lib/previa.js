// Los datos de la previa del ejercicio (rediseño 2026-09-27, pieza 3): lo
// que se ve debajo de la tarjeta con la sesión abierta y el ejercicio sin
// empezar. Todo sale de funciones que ya existen (charts, muscle,
// objetivoHoy); acá sólo se eligen la ventana y la forma. Criterio de la
// app: sin dato, null — nunca un cero ni una estimación disfrazada de hecho.
import { S, wDisplay } from './state.js';
import { e1rmSeries, trend } from './charts.js';
import { objetivoHoy } from './objetivoHoy.js';
import { lastDataFor } from './session.js';
import { catOf, daysSinceGroup, diasTexto } from './muscle.js';
import { recuperacion, zonasDeEjercicio } from './recuperacion.js';
import { round1, dstr } from './format.js';
import { sufijoPeso } from './equip.js';

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
export function fuerzaPrevia(ex, { uni = false, hoy = dstr() } = {}) {
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
    hace: haceTexto(Math.max(0, diasEntre(ultimo.date, hoy))),
  };
}

/** La línea debajo del 1RM: "▲ 6 % en 8 semanas". `tono` elige el color
    (sube = verde, baja = rojo, igual = neutro). Sin cambio medible, null:
    la UI dice otra cosa en vez de un "0 %" inventado. */
export function cambioTexto(fuerza) {
  if (fuerza?.cambioPct == null || !(fuerza.semanas > 0)) return null;
  const sem = `${fuerza.semanas} semana${fuerza.semanas === 1 ? '' : 's'}`;
  if (fuerza.cambioPct === 0) return { tono: 'igual', texto: `sin cambio en ${sem}` };
  const sube = fuerza.cambioPct > 0;
  return { tono: sube ? 'sube' : 'baja', texto: `${sube ? '▲' : '▼'} ${Math.abs(fuerza.cambioPct)} % en ${sem}` };
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

/** "Récord": la serie MÁS PESADA (peso máximo, con sus reps) y hace
    cuánto — el mismo número grande que muestra Progreso → PRs. Al mismo
    peso gana la de más reps; en empate exacto, la primera vez que se logró.
    Se busca por nombre (y lateralidad), igual que Progreso. */
export function recordPrevia(ex, { uni = false, hoy = dstr() } = {}) {
  const key = clave(ex, uni);
  let mejor = null;
  const cronologico = [...(S.sessions || [])].sort((a, b) => a.start - b.start);
  for (const s of cronologico) {
    for (const e of s.entries || []) {
      if (clave(e, !!e.unilateral) !== key) continue;
      for (const st of e.sets || []) {
        if (!(st.w > 0)) continue;
        if (!mejor || st.w > mejor.w || (st.w === mejor.w && st.r > mejor.r)) mejor = { w: st.w, r: st.r, date: s.date };
      }
    }
  }
  if (!mejor) return null;
  const dias = Math.max(0, diasEntre(mejor.date, hoy));
  return { ...mejor, dias, hace: haceTexto(dias) };
}

/** "Recuperación" del grupo del ejercicio. `dias` null = el grupo nunca se
    entrenó: recoveryPct() devuelve 100 en ese caso, y la UI tiene que decir
    "sin registro" en vez de afirmar un 100 %. null si el grupo no se
    reconoce. */
export function recuperacionPrevia(ex) {
  const cat = catOf(ex);
  if (!cat) return null;
  /* El modelo por horas (lib/recuperacion.js), por ZONA: un leg press dice
     "Cuádriceps" y no "Pierna", así el femoral de ayer no lo frena. */
  const zona = zonasDeEjercicio(ex)[0] || cat;
  const r = recuperacion(S.sessions)[zona];
  return { cat: zona, pct: r ? r.pct : 100, dias: r ? daysSinceGroup(cat) : null };
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
export function metaTexto(meta, sufijo = '') {
  if (!meta) return '';
  const unidad = S.cfg.unit === 'lb' ? 'lb' : 'kg';
  const partes = [];
  // `sufijo`: qué es el número ("17.5 kg c/u" en mancuernas, sufijoPeso).
  if (meta.peso != null) partes.push(`${meta.tipo === 'sugerido' ? '~' : ''}${wDisplay(meta.peso)} ${unidad}${sufijo}${meta.reps ? ` × ${meta.reps}` : ''}`);
  else if (meta.reps) partes.push(`${meta.reps} reps`);
  if (meta.texto) partes.push(meta.texto);
  return partes.join(' · ');
}

/** La meta partida en dos: los números ("47.5 kg × 8", van en la
    condensada) y el porqué ("1 rep más que la última", en texto). */
export function metaPartes(meta, sufijo = '') {
  const [numeros = '', ...resto] = metaTexto(meta, sufijo).split(' · ');
  return { numeros, porque: resto.join(' · ') };
}

/** La columna "Hoy" del aviso de "Sesión anterior" (ExerciseCarousel): la
    MISMA meta que la línea "Meta de hoy" de la tarjeta. Antes salía de
    objetivoHoy ("sumá reps · meta 12", el tope del rango) y la tarjeta decía
    "45 kg × 8": dos metas para lo mismo. Subir de peso lleva la flecha. */
export function columnaHoy(meta, sufijo = '') {
  if (!meta) return { numeros: '—', porque: '' };
  const { numeros, porque } = metaPartes(meta, sufijo);
  return { numeros: numeros ? `${numeros}${meta.tipo === 'subir' ? ' ↑' : ''}` : '—', porque };
}

/** Todo lo que muestra la previa de un ejercicio. `primeraVez` es la misma
    condición que el "Primera vez" de la tarjeta (sin historial con ESTE
    equipo, lastDataFor): en ese caso no hay gráfico ni récord, y el peso
    sugerido por 1RM, si existe, llega en `meta` (tipo 'sugerido'). */
export function previaEjercicio(ex, { uni = false, ajuste = 0, hoy = dstr() } = {}) {
  const primeraVez = !lastDataFor(ex);
  return {
    primeraVez,
    fuerza: primeraVez ? null : fuerzaPrevia(ex, { uni, hoy }),
    record: primeraVez ? null : recordPrevia(ex, { uni, hoy }),
    recuperacion: recuperacionPrevia(ex),
    meta: metaHoy(ex, { uni, ajuste }),
    // qué es el número del peso: " c/u" en mancuernas (equip.js)
    sufijo: sufijoPeso(ex, uni),
  };
}
