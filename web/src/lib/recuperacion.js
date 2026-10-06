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
import { norm } from './format.js';

/** Las zonas que se muestran: los grupos de la app con Pierna partida en dos
    (cuádriceps y femoral se entrenan en días distintos) y Espalda en tres
    (2026-10-06, Enzo: "espalda no es un grupo en general, tiene trapecios y
    dorsales"): un jalón carga el dorsal y no el trapecio, y juntarlos frenaba
    al uno por el otro. El grupo "Espalda" sigue entero para armar la rutina y
    ordenar la sesión: se parte sólo acá.

    El dorsal NO se parte en alto y bajo con un % cada uno, aunque Enzo lo
    pidió y las regiones existen (fibras torácicas vs. ilíacas; Paton & Brown
    1995, Muñoz-Garcés 2026): la diferencia está medida en EMG isométrico y
    nadie midió cuánto tarda en recuperarse cada región. Un % por región sería
    un número inventado. Va un % del dorsal y el reparto de series por región
    (dorsalPorRegion), como las cabezas del tríceps. */
export const ZONAS = ['Pecho', 'Trapecio', 'Romboides', 'Dorsal', 'Lumbares', 'Hombro', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Femoral', 'Glúteo', 'Gemelos', 'Abs'];

/** Horas hasta el 100 % para una sesión "normal" (6 series, RIR 2). */
export const VENTANA_BASE = {
  Pecho: 60, Trapecio: 54, Romboides: 60, Dorsal: 72, Lumbares: 72, Hombro: 54, Bíceps: 48, Tríceps: 48,
  Cuádriceps: 72, Femoral: 72, Glúteo: 66, Gemelos: 42, Abs: 42,
};

/** Cuánto estira la ventana el esfuerzo: al fallo tarda más, con margen menos. */
const POR_RIR = [1.15, 1.05, 1, 0.92, 0.85];
/** RIR que se asume cuando no contestaste ninguno: el que pide la rutina en promedio. */
const RIR_SUPUESTO = 2;

const HORA = 3600000;

/** A qué zonas va un ejercicio. Pierna se parte con la tabla de fibras:
    curl femoral → Femoral, leg press → Cuádriceps; uno que no se reconoce
    (o que trabaja las dos) va a las dos, que es decir de más en vez de
    esconder una zona cargada. */
export function zonasDeEjercicio(ex) {
  const cat = catOf(ex);
  if (!cat) return [];
  if (cat === 'Espalda') return zonasDeEspalda(ex);
  if (cat !== 'Pierna') return ZONAS.includes(cat) ? [cat] : [];
  const p = fibrasDe(ex)?.p || [];
  const out = [];
  if (p.some(n => /^vasto|cuádri|flexores de cadera/i.test(n))) out.push('Cuádriceps');
  if (p.includes('Femoral')) out.push('Femoral');
  return out.length ? out : ['Cuádriceps', 'Femoral'];
}

/** Espalda, por lo que trabaja: jalón, dominadas y remos → Dorsal (sus dos
    porciones de fibras.js); encogimientos → Trapecio; lo que lleva la
    escápula atrás con los codos abiertos (Kelso, remo espalda alta) →
    Romboides, que acá es "espalda media": romboides y trapecio medio. Con los
    codos abiertos a 60–90° el dorsal casi no trabaja (de Abreu Vasconcelos
    2023, vía la revisión de Di Fonza 2026), por eso esos no suman al dorsal.

    Romboides va por nombre y no por fibras.js porque la lámina no lo dibuja
    (está debajo del trapecio) y fibras.js sólo nombra lo que se puede pintar
    (fibras-bodydata-bridge.test.js).

    El peso muerto no tiene porción de espalda principal (es femoral y
    glúteo), pero su grupo es Espalda: cuenta lo que la espalda hace de
    sostén, sus secundarios (trapecio y lumbares). Uno que no se reconoce va
    al dorsal: decir de más antes que esconder. */
const ROMBOIDES = ['kelso', 'espalda alta', 'romboide', 'retraccion'];
const PORCION_A_ZONA = { Trapecio: 'Trapecio', 'Dorsal alto': 'Dorsal', 'Dorsal bajo': 'Dorsal', Lumbares: 'Lumbares' };
function zonasDeEspalda(ex) {
  const n = norm(ex?.name);
  if (ROMBOIDES.some(k => n.includes(k))) return ['Romboides'];
  const f = fibrasDe(ex);
  const de = xs => [...new Set((xs || []).map(x => PORCION_A_ZONA[x]).filter(Boolean))];
  const p = de(f?.p);
  const zs = p.length ? p : de(f?.s);
  const out = zs.length ? zs : ['Dorsal'];
  return ZONAS.filter(z => out.includes(z));
}

/** Series de dorsal desde `desde`, por región: `alto` (fibras de arriba, con
    el redondo mayor: remos en polea, sentado, neutro — extensión del hombro),
    `bajo` (fibras que bajan a la cadera: jalón, dominadas — aducción desde el
    brazo arriba) y `ambos` (remo con barra, en T, genéricos). Orientativo: la
    diferencia por región está medida en EMG isométrico (Paton & Brown 1995,
    Muñoz-Garcés 2026), no en series reales. */
export function dorsalPorRegion(sesiones, desde) {
  const out = { alto: 0, bajo: 0, ambos: 0 };
  for (const s of sesiones || []) {
    if (!s.date || s.date < desde) continue;
    for (const e of s.entries || []) {
      if (!e.sets?.length || !zonasDeEjercicio(e).includes('Dorsal')) continue;
      const p = fibrasDe(e)?.p || [];
      const a = p.includes('Dorsal alto'), b = p.includes('Dorsal bajo');
      out[a && !b ? 'alto' : b && !a ? 'bajo' : 'ambos'] += seriesDe(e);
    }
  }
  return out;
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
    (hamstring → Femoral; cuádriceps, aductores, flexores, tibial → Cuádriceps)
    y Espalda también: trapezius → Trapecio; upperBack (la porción alta del
    dorsal, junto al redondo mayor) y lats (la baja) → Dorsal. Romboides no
    tiene forma: está debajo del trapecio. */
const FORMA_ESPALDA = { trapezius: 'Trapecio', upperBack: 'Dorsal', lats: 'Dorsal' };
export function zonaDeForma(cat, slug) {
  if (cat === 'Espalda') return FORMA_ESPALDA[slug] || null;
  if (cat !== 'Pierna') return ZONAS.includes(cat) ? cat : null;
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
