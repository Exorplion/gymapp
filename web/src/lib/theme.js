// Color: una base grafito FIJA y UN acento que elige cada uno.
//
// La base (fondo, vidrio, textos, líneas) es la identidad de la app y vive
// en styles.css, igual para todos. Lo único que se elige es el MATIZ del
// acento, y de ese número sale todo lo demás: el color de énfasis, el
// arranque oscuro de los degradados, el texto que va encima, los canales
// para los rgba() y la escala del mapa muscular.
//
// Por qué OKLCH y no HSL (que es lo que había): en HSL "misma luminosidad"
// no significa "se ve igual de claro" — un amarillo y un azul al 60 % son
// dos brillos distintos, y por eso la receta vieja daba un violeta
// ilegible y un amarillo que se comía el texto. En OKLCH la L es la
// luminosidad percibida: fijándola (.80 el acento, .62 el fuerte), cualquier
// matiz queda con el mismo peso y el mismo contraste. El croma también es
// fijo por preset, y si un color no entra en la pantalla (sRGB) se le baja
// el croma hasta que entre, sin tocar el matiz ni la luz.
//
// Relevamiento y diseño: docs/superpowers/specs/2026-09-27-rediseno-sesion-y-color-design.md §4.

/* ---------- OKLCH ↔ sRGB (matrices de Björn Ottosson) ---------- */
const aLineal = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const aGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchALineal(L, C, h) {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad), b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const enGamut = v => v.every(x => x >= -1e-4 && x <= 1 + 1e-4);

/** OKLCH → "#rrggbb". Si el color no existe en sRGB se busca el croma más
    alto que sí entra (búsqueda binaria), con la misma luz y el mismo matiz.
    Devuelve también el croma que quedó, para poder medirlo. */
export function oklchAHex(L, C, h) {
  let c = C;
  if (!enGamut(oklchALineal(L, C, h))) {
    let lo = 0, hi = C;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (enGamut(oklchALineal(L, mid, h))) lo = mid; else hi = mid;
    }
    c = lo;
  }
  const hex = oklchALineal(L, c, h)
    .map(x => Math.round(Math.min(1, Math.max(0, aGamma(Math.min(1, Math.max(0, x))))) * 255))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
  return { hex: `#${hex}`, c };
}

/** "#rrggbb" (o "#rgb") → { L, C, h }. null si no es un color. */
export function hexAOklch(hex) {
  const t = String(hex ?? '').replace('#', '').trim();
  const full = t.length === 3 ? t.split('').map(c => c + c).join('') : t;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const [R, G, B] = [0, 2, 4].map(i => aLineal(parseInt(full.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/* ---------- contraste WCAG ---------- */
function luminancia(hex) {
  const f = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => aLineal(parseInt(f.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores, siempre ≥ 1. */
export function contrastRatio(hexA, hexB) {
  const la = luminancia(hexA), lb = luminancia(hexB);
  const [alto, bajo] = la > lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

/* ---------- base y estados (copias de styles.css; un test exige que coincidan) ---------- */

/** La base grafito. Neutra a propósito: sin tinte azul, así el acento que
    elijas es el único color de la pantalla. */
export const BASE = {
  bg: '#101113',
  glassRgb: [34, 35, 39],
  glassAlfa: 0.66,
  surface: '#18191c',
  surface2: '#202125',
  text: '#f3f4f6',
  text2: '#b1b1b9',
  text3: '#97979f',
};

/** Cuánto acento fuerte lleva la esquina de las tarjetas hero (styles.css).
    Es el fondo más claro detrás de texto chico: los tests de contraste lo
    usan como peor caso. */
export const HERO_TINTE = 0.14;

/** Los colores de estado: reservados, no cambian con el acento. */
export const ESTADOS = { danger: '#F87171', warn: '#FBBF24', ok: '#34D399', flame: '#FFC46B' };

/* ---------- el acento ---------- */

export const PRESETS = [
  { id: 'hielo', nombre: 'Hielo', h: 225, c: 0.13 },
  { id: 'cobalto', nombre: 'Cobalto', h: 262, c: 0.16 },
  { id: 'violeta', nombre: 'Violeta', h: 295, c: 0.15 },
  { id: 'fucsia', nombre: 'Fucsia', h: 345, c: 0.17 },
  { id: 'mono', nombre: 'Monocromo', h: 0, c: 0 },
];
export const ACENTO_DEFECTO = { id: 'hielo' };

/** El croma del personalizado: del color elegido se toma SÓLO el matiz. Así
    elegir un celeste lavado o uno neón da el mismo acento, con el mismo
    contraste que los presets. */
export const CROMA_PROPIO = 0.15;

/** Distancia entre dos matices en la rueda, en [0, 180]. */
export function distanciaMatiz(a, b) {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** A menos de esto de un estado, el acento se confunde con él. */
const MARGEN = 20;

/* Las zonas prohibidas: cada estado ± MARGEN. Rojo, llama y ámbar quedan
   tan cerca que entre sus zonas hay un hueco de ~14°: un matiz ahí (un
   naranja) estaría "permitido" pero se confundiría con los dos, así que las
   zonas con un hueco menor que MARGEN se funden en una sola. */
const ZONAS = (() => {
  const tramos = Object.values(ESTADOS)
    .map(hex => hexAOklch(hex).h)
    .sort((a, b) => a - b)
    .map(h => [h - MARGEN, h + MARGEN]);
  const fundidas = [];
  for (const t of tramos) {
    const ult = fundidas[fundidas.length - 1];
    if (ult && t[0] - ult[1] < MARGEN) ult[1] = Math.max(ult[1], t[1]);
    else fundidas.push([...t]);
  }
  return fundidas.map(([a, b]) => ({ centro: (a + b) / 2, radio: (b - a) / 2 }));
})();

/** Si el matiz cae en la zona de un estado, lo lleva al borde más cercano
    de esa zona (con un grado de aire para el redondeo a 8 bits). */
export function alejarDeEstados(h) {
  const n = ((h % 360) + 360) % 360;
  for (const z of ZONAS) {
    if (distanciaMatiz(n, z.centro) < z.radio) {
      const arriba = z.centro + z.radio + 1, abajo = z.centro - z.radio - 1;
      const destino = distanciaMatiz(n, arriba) <= distanciaMatiz(n, abajo) ? arriba : abajo;
      return Math.round(((destino % 360) + 360) % 360);
    }
  }
  return n;
}

/** La selección guardada → { h, c }. Nunca devuelve algo roto: un id
    desconocido o un matiz inválido caen al de fábrica. */
export function acentoDe(sel) {
  if (sel?.id === 'propio' && Number.isFinite(sel.h)) return { h: alejarDeEstados(sel.h), c: CROMA_PROPIO };
  const p = PRESETS.find(x => x.id === sel?.id) || PRESETS.find(x => x.id === ACENTO_DEFECTO.id);
  return { h: p.h, c: p.c };
}

const canales = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');

/** Todas las custom properties que dependen del acento. Lo demás del CSS
    se arma con estas (el degradado, el glow, los halos, la arista). */
export function variablesDe({ h, c }) {
  const accent = oklchAHex(0.8, c, h).hex;
  const strong = oklchAHex(0.62, c * 1.1, h).hex;
  const on = oklchAHex(0.18, Math.min(c, 0.03), h).hex;
  /* El mapa muscular es una escala de luminosidad del mismo matiz: cuanto
     más reciente el entrenamiento, más luz. Cada tono son tres paradas
     (luz, cuerpo, sombra) para el volumen del músculo. El cuarto escalón
     (7+ días) no sale del acento: es el ámbar de "atención", fijo en CSS. */
  const esc = [
    [[0.93, 0.55], [0.8, 1], [0.5, 0.9]],
    [[0.74, 0.8], [0.6, 1], [0.36, 0.8]],
    [[0.54, 0.5], [0.43, 0.5], [0.27, 0.4]],
  ];
  const mapa = {};
  esc.forEach((paradas, i) => {
    ['hi', 'md', 'lo'].forEach((k, j) => {
      const [L, f] = paradas[j];
      mapa[`--mapa-${i}-${k}`] = oklchAHex(L, c * f, h).hex;
    });
  });
  return {
    '--accent': accent,
    '--accent-strong': strong,
    '--on-accent': on,
    '--accent-rgb': canales(accent),
    '--accent-strong-rgb': canales(strong),
    ...mapa,
  };
}

/** Qué acento usar según lo guardado, migrando el `themeColor` viejo (un hex
    libre de la paleta anterior) la primera vez: al preset más cercano si
    está a ≤ 15° de matiz, si no a un personalizado con ese matiz. Negro,
    blanco y grises no tienen matiz: vuelven al de fábrica. */
export function acentoGuardado(cfg) {
  const guardado = cfg?.acento;
  if (guardado) {
    const valido = PRESETS.some(p => p.id === guardado.id) || (guardado.id === 'propio' && Number.isFinite(guardado.h));
    return { sel: valido ? guardado : ACENTO_DEFECTO, migrado: false };
  }
  if (!cfg?.themeColor) return { sel: ACENTO_DEFECTO, migrado: false };
  const o = hexAOklch(cfg.themeColor);
  if (!o || o.C < 0.03) return { sel: ACENTO_DEFECTO, migrado: true };
  const cerca = PRESETS.filter(p => p.c > 0)
    .map(p => ({ p, d: distanciaMatiz(p.h, o.h) }))
    .sort((a, b) => a.d - b.d)[0];
  if (cerca.d <= 15) return { sel: { id: cerca.p.id }, migrado: true };
  return { sel: { id: 'propio', h: alejarDeEstados(Math.round(o.h)) }, migrado: true };
}

/** El evento que avisa que cambió el acento: lo escuchan los que dibujan con
    colores leídos una vez (el canvas del gráfico). */
export const EVENTO_ACENTO = 'fierro:acento';

/** Lee el valor actual de un token de styles.css (con el acento aplicado). */
export function leerToken(nombre) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/** Aplica el acento como estilo inline en <html>: le gana a los valores de
    :root por especificidad, y todo lo que se arma con var() lo sigue solo. */
export function aplicarAcento(sel) {
  if (typeof document === 'undefined') return;
  const vars = variablesDe(acentoDe(sel));
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  // La barra del sistema toma el fondo de la app, leído del token para que
  // no haya un tercer casi-negro escrito a mano.
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = leerToken('--bg') || BASE.bg;
  window.dispatchEvent(new CustomEvent(EVENTO_ACENTO, { detail: vars }));
}
