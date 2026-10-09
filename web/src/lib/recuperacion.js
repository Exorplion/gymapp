// Recuperación muscular ESTIMADA, por horas (2026-10-01).
//
// Reemplaza la cuenta vieja de recoveryPct (muscle.ts), que iba en días
// enteros: 0 → 50 → 100 % sin nada en el medio, y metía cuádriceps y femoral
// en la misma bolsa "Pierna" (el femoral de ayer bloqueaba la sentadilla de
// hoy).
//
// LÍMITE HONESTO: es un modelo, no una medición. Se apoya en lo que la app SÍ
// sabe —cuándo fue tu última serie de cada zona, cuántas series hiciste y qué
// tan cerca del fallo quedaste (el RIR que contestás)— y en el consenso
// habitual de que un músculo grande tarda más que uno chico. Por eso la UI
// siempre dice "estimado".
//
// Simplificaciones a sabiendas:
// - Cuenta sólo la ÚLTIMA sesión que tocó la zona (no arrastra fatiga de las
//   anteriores).
// - Cuenta los músculos PRINCIPALES del ejercicio (su grupo), no los que
//   acompañan: el tríceps de un press de banca no suma. Sumarlos con un peso
//   inventado sería precisión que no existe.
import { catOf } from './muscle.js';
import { fibrasDe } from './fibras.js';

/** Las zonas que se muestran: los grupos de la app con Pierna partida en dos
    (cuádriceps y femoral se entrenan en días distintos) y Espalda en las
    cuatro piezas que dibuja la lámina (2026-10-06, Enzo: "espalda no es un
    grupo en general, tiene trapecios y dorsales"): trapecio superior,
    romboides (con el trapecio medio), dorsal alto (con el redondo mayor) y
    dorsal bajo. Un jalón carga el dorsal bajo y no el trapecio, y juntarlos
    frenaba al uno por el otro. El grupo "Espalda" sigue entero para armar la
    rutina y ordenar la sesión: se parte sólo acá.

    Dorsal alto y bajo con un % cada uno lo pidió Enzo dos veces. Las regiones
    existen (fibras torácicas vs. ilíacas: Paton & Brown 1995, Muñoz-Garcés
    2026), pero la diferencia está medida en EMG isométrico: qué ejercicio va a
    cuál es una estimación, y la UI lo dice.

    2026-10-08, Enzo: "el hombro tiene tres partes" y "femoral no debería
    estar en anterior". Hombro se parte en anterior, lateral y posterior
    (los pájaros de Posterior ya no frenan el press militar de Anterior), y
    los aductores son zona propia: antes caían en "no sé" y se contaban como
    cuádriceps Y femoral.

    El orden es el del cuerpo, de arriba abajo, agrupado por REGIONES. */
export const ZONAS = [
  'Pecho', 'Hombro anterior', 'Hombro lateral', 'Hombro posterior',
  'Trapecio', 'Romboides', 'Dorsal alto', 'Dorsal bajo', 'Lumbares',
  'Bíceps', 'Tríceps', 'Abs',
  'Glúteo', 'Cuádriceps', 'Aductores', 'Femoral', 'Gemelos',
];

/** Las zonas por región, para listarlas ordenadas (Enzo, 2026-10-08:
    "debería estar más organizado"). Todas las ZONAS, cada una una vez. */
export const REGIONES = [
  { nombre: 'Pecho y hombros', zonas: ['Pecho', 'Hombro anterior', 'Hombro lateral', 'Hombro posterior'] },
  { nombre: 'Espalda', zonas: ['Trapecio', 'Romboides', 'Dorsal alto', 'Dorsal bajo', 'Lumbares'] },
  { nombre: 'Brazos', zonas: ['Bíceps', 'Tríceps'] },
  { nombre: 'Abdomen', zonas: ['Abs'] },
  { nombre: 'Piernas', zonas: ['Glúteo', 'Cuádriceps', 'Aductores', 'Femoral', 'Gemelos'] },
];

/** Las zonas dadas, repartidas en sus regiones (sin las regiones vacías). */
export const porRegion = zonas => REGIONES
  .map(r => ({ nombre: r.nombre, zonas: r.zonas.filter(z => zonas.includes(z)) }))
  .filter(r => r.zonas.length);

/** Horas hasta el 100 % para una sesión "normal" (6 series, RIR 2). Las
    tres porciones del hombro son músculos chicos; el anterior un poco más
    porque además lo cargan todos los press. */
export const VENTANA_BASE = {
  Pecho: 60, 'Hombro anterior': 54, 'Hombro lateral': 48, 'Hombro posterior': 48,
  Trapecio: 54, Romboides: 60, 'Dorsal alto': 66, 'Dorsal bajo': 72, Lumbares: 72, Bíceps: 48, Tríceps: 48,
  Cuádriceps: 72, Aductores: 60, Femoral: 72, Glúteo: 66, Gemelos: 42, Abs: 42,
};

/** Cuánto estira la ventana el esfuerzo: al fallo tarda más, con margen menos. */
const POR_RIR = [1.15, 1.05, 1, 0.92, 0.85];
/** RIR que se asume cuando no contestaste ninguno: el que pide la rutina en promedio. */
const RIR_SUPUESTO = 2;

const HORA = 3600000;

/** A qué zonas va un ejercicio. Pierna se parte con la tabla de fibras:
    curl femoral → Femoral, leg press → Cuádriceps, aductor → Aductores,
    abductor → Glúteo (el medio); uno que no se reconoce va a cuádriceps y
    femoral, que es decir de más en vez de esconder una zona cargada.
    Hombro igual: cada porción a la suya, y uno sin reconocer a las tres. */
export function zonasDeEjercicio(ex) {
  const cat = catOf(ex);
  if (!cat) return [];
  if (cat === 'Espalda') return zonasDeEspalda(ex);
  if (cat === 'Hombro') return zonasDeHombro(ex);
  if (cat !== 'Pierna') return ZONAS.includes(cat) ? [cat] : [];
  const p = fibrasDe(ex)?.p || [];
  const out = [];
  if (p.some(n => /^glúteo/i.test(n))) out.push('Glúteo');
  if (p.some(n => /^vasto|cuádri|flexores de cadera/i.test(n))) out.push('Cuádriceps');
  if (p.includes('Aductores')) out.push('Aductores');
  if (p.includes('Femoral')) out.push('Femoral');
  return out.length ? ZONAS.filter(z => out.includes(z)) : ['Cuádriceps', 'Femoral'];
}

const PORCION_DE_HOMBRO = { 'Deltoides anterior': 'Hombro anterior', 'Deltoides lateral': 'Hombro lateral', 'Deltoides posterior': 'Hombro posterior' };
const HOMBRO_ENTERO = ['Hombro anterior', 'Hombro lateral', 'Hombro posterior'];
function zonasDeHombro(ex) {
  const zs = (fibrasDe(ex)?.p || []).map(n => PORCION_DE_HOMBRO[n]).filter(Boolean);
  return zs.length ? HOMBRO_ENTERO.filter(z => zs.includes(z)) : HOMBRO_ENTERO;
}

/** Espalda, por la porción que trabaja (fibras.js, que nombra las mismas
    piezas que dibuja la lámina): jalón y dominadas → Dorsal bajo; remos en
    polea, sentado o neutro → Dorsal alto; remo genérico → los dos;
    encogimientos → Trapecio; codos abiertos y Kelso → Romboides y Trapecio.

    El peso muerto no tiene porción de espalda principal (es femoral y
    glúteo), pero su grupo es Espalda: cuenta lo que la espalda hace de
    sostén, sus secundarios (trapecio y lumbares). Uno que no se reconoce va
    a las dos del dorsal: decir de más antes que esconder. */
const PORCION_A_ZONA = { Trapecio: 'Trapecio', Romboides: 'Romboides', 'Dorsal alto': 'Dorsal alto', 'Dorsal bajo': 'Dorsal bajo', Lumbares: 'Lumbares' };
function zonasDeEspalda(ex) {
  const f = fibrasDe(ex);
  const de = xs => [...new Set((xs || []).map(x => PORCION_A_ZONA[x]).filter(Boolean))];
  const p = de(f?.p);
  const zs = p.length ? p : de(f?.s);
  const out = zs.length ? zs : ['Dorsal alto', 'Dorsal bajo'];
  return ZONAS.filter(z => out.includes(z));
}

/** El momento de la última serie de una entrada: su `t` si lo tiene, si no
    el cierre de la sesión, el arranque, o el mediodía de la fecha. */
function momentoDe(s, e) {
  const ts = (e.sets || []).map(x => x.t).filter(Number.isFinite);
  if (ts.length) return Math.max(...ts);
  if (Number.isFinite(s.end)) return s.end;
  if (Number.isFinite(s.start)) return s.start;
  return s.date ? new Date(s.date + 'T12:00:00').getTime() : null;
}

const seriesDe = e => {
  const n = (e.sets || []).length;
  return e.unilateral ? Math.ceil(n / 2) : n;
};

/** RIR promedio de las series contestadas (rpe → rir = 10 − rpe; 6 = "4+"). */
function rirDe(sets) {
  const rirs = sets.map(x => x.rpe).filter(v => v != null).map(rpe => Math.max(0, Math.min(4, 10 - rpe)));
  return rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
}

/** Horas que necesita una zona según lo que hiciste. */
export function ventanaHoras(zona, series, rir) {
  const base = VENTANA_BASE[zona] ?? 60;
  const vol = Math.min(1.35, Math.max(0.8, 0.75 + 0.05 * series));
  const r = rir == null ? RIR_SUPUESTO : rir;
  const esf = POR_RIR[Math.max(0, Math.min(4, Math.round(r)))];
  return base * vol * esf;
}

/** 'cargado' < 60 % ≤ 'recuperando' < 90 % ≤ 'listo'. */
export const estadoDe = pct => (pct < 60 ? 'cargado' : pct < 90 ? 'recuperando' : 'listo');

/** La recuperación de cada zona.

    Devuelve `{ [zona]: null | { pct, estado, listaEn, horas, series, rir,
    dayName, date, ejercicios: [{ name, series, rir }] } }`. null = nunca la
    entrenaste: no es "100 %", es "sin dato" (la UI no tiene que afirmar que
    está lista algo que no conoce). */
export function recuperacion(sesiones, ahora = Date.now()) {
  const out = Object.fromEntries(ZONAS.map(z => [z, null]));
  const ordenadas = [...(sesiones || [])].sort((a, b) => (b.start || 0) - (a.start || 0) || (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  for (const s of ordenadas) {
    // Por zona, todo lo de ESTA sesión: momento, series, RIR y ejercicios.
    const acc = {};
    for (const e of s.entries || []) {
      if (!e.sets?.length) continue;
      for (const z of zonasDeEjercicio(e)) {
        if (out[z] !== null) continue; // ya la resolvió una sesión más nueva
        const a = acc[z] || (acc[z] = { momento: 0, series: 0, sets: [], ejercicios: [] });
        a.momento = Math.max(a.momento, momentoDe(s, e) || 0);
        a.series += seriesDe(e);
        a.sets.push(...e.sets);
        a.ejercicios.push({ name: e.name, series: seriesDe(e), rir: rirDe(e.sets) });
      }
    }
    for (const [z, a] of Object.entries(acc)) {
      const rir = rirDe(a.sets);
      const ventana = ventanaHoras(z, a.series, rir);
      const horas = Math.max(0, (ahora - a.momento) / HORA);
      const pct = Math.min(100, Math.round((horas / ventana) * 100));
      out[z] = {
        pct, estado: estadoDe(pct), listaEn: a.momento + ventana * HORA, horas,
        series: a.series, rir, dayName: s.dayName || null, date: s.date, ejercicios: a.ejercicios,
      };
    }
    if (ZONAS.every(z => out[z] !== null)) break;
  }
  return out;
}

/** Las zonas que trabaja un turno, en el orden de ZONAS (2026-10-03: la
    tarjeta de Inicio y el mapa muestran primero lo del turno que toca). */
export function zonasDeTurno(slot) {
  const hay = new Set((slot?.exercises || []).flatMap(e => zonasDeEjercicio(e)));
  return ZONAS.filter(z => hay.has(z));
}

/** Series por zona desde la fecha `desde` ('YYYY-MM-DD', incluida). Cuenta
    igual que recuperacion(): músculos principales, y en unilaterales cada
    par de lados es una serie. Toda zona viene, con 0 si no hubo nada. */
export function seriesPorZona(sesiones, desde) {
  const out = Object.fromEntries(ZONAS.map(z => [z, 0]));
  for (const s of sesiones || []) {
    if (!s.date || s.date < desde) continue;
    for (const e of s.entries || []) {
      if (!e.sets?.length) continue;
      for (const z of zonasDeEjercicio(e)) out[z] += seriesDe(e);
    }
  }
  return out;
}

/** Series de tríceps desde `desde`, por cabeza: `larga` lo hecho con el
    brazo arriba (extensión sobre la cabeza, overhead — Maeo 2022: es lo que
    más hace crecer la cabeza larga) y `resto` todo lo demás (pushdown, JM
    press, rompecráneos: lateral y medial, más parejo). No es un % por
    cabeza: las tres se recuperan juntas y un número así no existe. */
export function cabezasTriceps(sesiones, desde) {
  const out = { larga: 0, resto: 0 };
  for (const s of sesiones || []) {
    if (!s.date || s.date < desde) continue;
    for (const e of s.entries || []) {
      if (!e.sets?.length || !zonasDeEjercicio(e).includes('Tríceps')) continue;
      const larga = (fibrasDe(e)?.p || []).includes('Tríceps cabeza larga');
      out[larga ? 'larga' : 'resto'] += seriesDe(e);
    }
  }
  return out;
}

const DIA_SEMANA = t => new Date(t).toLocaleDateString('es', { weekday: 'long' });

/** Los cuatro momentos del "Cómo vas a estar" del mapa: ahora, esta noche
    (las 22; si faltan menos de 2 h, "en 12 h"), mañana y pasado a esta
    misma hora. `horas` es cuánto se adelanta el reloj de recuperacion(). */
export function momentos(ahora = Date.now()) {
  const noche = new Date(ahora);
  noche.setHours(22, 0, 0, 0);
  const hNoche = (noche.getTime() - ahora) / HORA;
  const d1 = DIA_SEMANA(ahora + 24 * HORA), d2 = DIA_SEMANA(ahora + 48 * HORA);
  const may = t => t[0].toUpperCase() + t.slice(1);
  return [
    { etiqueta: 'Ahora', texto: 'ahora', horas: 0 },
    hNoche >= 2
      ? { etiqueta: 'Noche', texto: 'esta noche', horas: hNoche }
      : { etiqueta: 'En 12 h', texto: 'en 12 horas', horas: 12 },
    { etiqueta: may(d1), texto: `el ${d1} a esta hora`, horas: 24 },
    { etiqueta: may(d2), texto: `el ${d2} a esta hora`, horas: 48 },
  ];
}

/** La zona que pinta cada forma de la lámina: Pierna se reparte por su slug
    (hamstring → Femoral; adductors → Aductores; cuádriceps, flexores,
    tibial → Cuádriceps)
    y Espalda también: trapezius → Trapecio, rhomboids → Romboides,
    upperBack (porción alta del dorsal, junto al redondo mayor) → Dorsal alto,
    lats → Dorsal bajo. Hombro, por porción (2026-10-08), y los aductores
    con su propia zona. */
const FORMA_ESPALDA = { trapezius: 'Trapecio', rhomboids: 'Romboides', upperBack: 'Dorsal alto', lats: 'Dorsal bajo' };
const FORMA_HOMBRO = { deltAnterior: 'Hombro anterior', deltLateral: 'Hombro lateral', deltPosterior: 'Hombro posterior' };
export function zonaDeForma(cat, slug) {
  if (cat === 'Espalda') return FORMA_ESPALDA[slug] || null;
  if (cat === 'Hombro') return FORMA_HOMBRO[slug] || null;
  if (cat !== 'Pierna') return ZONAS.includes(cat) ? cat : null;
  if (slug === 'adductors') return 'Aductores';
  return slug === 'hamstring' ? 'Femoral' : 'Cuádriceps';
}

/** Cuándo llega al 100 %, sin género (sirve para "pecho" y para "piernas"):
    "al 100 % en 5 h", "al 100 % mañana a la mañana", "al 100 % el sábado". */
export function cuandoLista(listaEn, ahora = Date.now()) {
  const h = (listaEn - ahora) / HORA;
  if (h <= 0) return 'al 100 %';
  if (h < 12) return `al 100 % en ${Math.max(1, Math.round(h))} h`;
  const d = new Date(listaEn), hoy = new Date(ahora);
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
  const franja = d.getHours() < 12 ? 'a la mañana' : d.getHours() < 19 ? 'a la tarde' : 'a la noche';
  if (dias <= 0) return `al 100 % hoy ${franja}`;
  if (dias === 1) return `al 100 % mañana ${franja}`;
  return `al 100 % el ${d.toLocaleDateString('es', { weekday: 'long' })}`;
}
