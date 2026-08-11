// Color libre: elegís UN color y la app arma la paleta entera a partir de él,
// no lo pega tal cual en todos lados.
//
// Por qué no simplemente usar el color que elegiste: la app tiene diez tonos
// distintos (--accent, --blue, --blue2, --blue3, --cyan, --deep, dos
// degradados, el texto que va ARRIBA del degradado, líneas, el resplandor de
// los botones) y eligieron esos valores concretos —no cualquier azul— para
// que combinen entre sí y para que el texto se lea sobre fondo casi negro.
// Pegar tu color en los diez lugares por igual daría, en el mejor caso, una
// pantalla de un solo tono sin jerarquía; en el peor, texto invisible si
// elegís algo oscuro.
//
// Lo que se conserva de tu elección es el MATIZ (hue) — de qué familia de
// color se trata. Todo lo demás (saturación, luminosidad, y hasta un
// pequeño corrimiento de matiz entre roles) sale de la receta del diseño
// original, medida acá abajo (HUE_SHIFT/SAT/LUM). Es la misma relación que
// ya existía entre --deep/--blue/--blue2/--blue3/--accent/--cyan, sólo que
// girada hasta tu matiz. Por eso "combinan": son la paleta de siempre, con
// otro color de base.
export function hexToHsl(hex) {
  const h = String(hex || '').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return null;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lum = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      default: hue = (r - g) / d + 4;
    }
    hue *= 60;
  }
  return { h: hue, s: sat * 100, l: lum * 100 };
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** HSL (h en grados 0-360, s/l en 0-100) a "#rrggbb". */
export function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  let r, g, b;
  if (ss === 0) { r = g = b = ll; }
  else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Luminancia relativa WCAG — no es "qué tan clara se ve" a ojo, es la mezcla
    ponderada que usa el estándar de contraste (el verde pesa mucho más que
    el azul: un azul y un verde con el mismo HSL L% NO tienen el mismo
    contraste real contra un fondo, y por eso no alcanza con mirar el % de
    luminosidad HSL para garantizar que se lea). */
function luminance(hex) {
  const full = hex.replace('#', '');
  const chan = v => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = chan(full.slice(0, 2)), g = chan(full.slice(2, 4)), b = chan(full.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores, siempre ≥1. */
export function contrastRatio(hexA, hexB) {
  const la = luminance(hexA), lb = luminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Sube (o baja) la luminosidad HSL de a pasos hasta que el contraste contra
    `fondoHex` llegue al mínimo pedido, o hasta agotar el rango — nunca
    entra en loop infinito porque L está acotada a [0,100]. Es lo que hace
    que la garantía de lectura no dependa de qué matiz hayas elegido: un
    azul profundo necesita subir más que un amarillo para el mismo contraste,
    y acá se sube lo que haga falta en cada caso. */
function conContraste(h, s, l, fondoHex, minimo, subir = true) {
  let actual = l;
  for (let i = 0; i < 50; i++) {
    const hex = hslToHex(h, s, actual);
    if (contrastRatio(hex, fondoHex) >= minimo) return { l: actual, hex };
    actual = subir ? Math.min(100, actual + 2) : Math.max(0, actual - 2);
    if (actual === 0 || actual === 100) break;
  }
  const hex = hslToHex(h, s, actual);
  return { l: actual, hex };   // el mejor que se pudo, aunque no llegue al mínimo
}

/** El fondo contra el que se miden accent/blue3 (usados como texto/ícono). */
const BG = '#04070F';
/** Contraste mínimo para texto grande / íconos sobre fondo casi negro (AA
    large-text, que es el estándar que aplica: los números y etiquetas de
    esta app son grandes y en negrita, no párrafos chicos). */
const MIN_CONTRASTE = 3;

/* La receta: de qué matiz de diferencia (grados) y con qué saturación/
   luminosidad HSL sale cada rol, medida directamente de la paleta original
   (--deep #2540E8, --blue #2E7DFF, --blue2 #5EA2FF, --blue3 #8FC2FF,
   --accent #7FD1FF, --cyan #22D3EE) tomando --blue como matiz ancla (0). */
const RECETA = {
  deep: { dh: 14.3717, s: 80.9129, l: 52.7451 },
  blue: { dh: 0, s: 100, l: 59.0196 },
  blue2: { dh: -2.6622, s: 100, l: 68.4314 },
  blue3: { dh: -4.6420, s: 100, l: 78.0392 },
  accent: { dh: -15.7581, s: 100, l: 74.9020 },
  cyan: { dh: -29.3794, s: 85.7143, l: 53.3333 },
};

/** Arma la paleta completa a partir de un color base (hex). Devuelve null si
    `hex` no es un color válido — nunca aplica una paleta a medio armar. */
export function paletaDesde(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const base = hsl.h;
  const tono = {};
  for (const [rol, r] of Object.entries(RECETA)) {
    tono[rol] = hslToHex(base + r.dh, r.s, r.l);
  }
  // accent y blue3 son los dos que esta app usa como TEXTO/ícono suelto
  // (cifras, etiquetas, día activo) — el resto son degradados o fondos de
  // botón, donde el contraste lo da --on-grad, no el tono en sí.
  tono.accent = conContraste(base + RECETA.accent.dh, RECETA.accent.s, RECETA.accent.l, BG, MIN_CONTRASTE, true).hex;
  tono.blue3 = conContraste(base + RECETA.blue3.dh, RECETA.blue3.s, RECETA.blue3.l, BG, MIN_CONTRASTE, true).hex;

  // El texto que va ARRIBA del degradado (botones grandes, chips "on"): se
  // prueba negro-azulado (como el original) y blanco, y gana el que dé más
  // contraste contra el tono del medio del degradado — así funciona tanto si
  // elegiste un azul oscuro como un amarillo casi blanco.
  const negro = '#03121F', blanco = '#F5FAFF';
  const onGrad = contrastRatio(negro, tono.blue2) >= contrastRatio(blanco, tono.blue2) ? negro : blanco;

  return {
    accent: tono.accent,
    deep: tono.deep,
    blue: tono.blue,
    blue2: tono.blue2,
    blue3: tono.blue3,
    cyan: tono.cyan,
    onGrad,
    grad: `linear-gradient(135deg,${tono.deep} 0%,${tono.blue2} 100%)`,
    grad2: `linear-gradient(112deg,${tono.blue2},${tono.cyan} 58%,${tono.accent})`,
    glow: `0 16px 40px -14px ${hexToRgba(tono.cyan, 0.6)}`,
    line: hexToRgba(tono.blue2, 0.10),
    line2: hexToRgba(tono.blue2, 0.20),
  };
}

function hexToRgba(hex, alpha) {
  const full = hex.replace('#', '');
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** El azul original, como valor por default y como para "restablecer". */
export const COLOR_DEFECTO = '#2E7DFF';

const VAR_DE = {
  accent: '--accent', deep: '--deep', blue: '--blue', blue2: '--blue2', blue3: '--blue3',
  cyan: '--cyan', onGrad: '--on-grad', grad: '--grad', grad2: '--grad2',
  glow: '--glow', line: '--line', line2: '--line2',
};

/** Aplica la paleta como custom properties en :root — pisa el valor por
    default de styles.css porque un estilo inline en el elemento raíz gana
    por especificidad. Sin `hex` (o inválido) vuelve al color de fábrica
    quitando los overrides, no fuerza el default a mano: así si algún token
    nuevo se agrega a styles.css en el futuro, "restablecer" lo hereda solo. */
export function aplicarPaleta(hex) {
  const root = document.documentElement.style;
  if (!hex) {
    Object.values(VAR_DE).forEach(v => root.removeProperty(v));
    return;
  }
  const p = paletaDesde(hex);
  if (!p) return;
  Object.entries(VAR_DE).forEach(([k, v]) => root.setProperty(v, p[k]));
}
