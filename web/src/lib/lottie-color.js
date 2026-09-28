// Recolorear un Lottie: los colores viven adentro del JSON como [r, g, b, a]
// en 0-1, y Lottie no entiende var(). Para que el estallido de récord siga al
// acento elegido se clona el JSON y se cambian los colores que coinciden.

/** El azul de la paleta anterior y el dorado de pr-burst.json. */
export const AZUL_LOTTIE = [0.184, 0.49, 1, 1];
export const DORADO_LOTTIE = [1, 0.706, 0.216, 1];

const igual = (a, b) => Array.isArray(a) && a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 0.01);

/** "r,g,b" (el formato de los tokens --*-rgb) → [r, g, b, 1] en 0-1. */
export const rgbALottie = rgb => [...rgb.split(',').map(n => Number(n) / 255), 1];

/** Copia del JSON con cada color `de` cambiado por su `a`. No muta el original. */
export function recolorearLottie(nodo, cambios) {
  if (Array.isArray(nodo)) return nodo.map(n => recolorearLottie(n, cambios));
  if (!nodo || typeof nodo !== 'object') return nodo;
  const out = {};
  for (const [k, v] of Object.entries(nodo)) {
    if (k === 'c' && v && Array.isArray(v.k)) {
      const cambio = cambios.find(([de]) => igual(v.k, de));
      out[k] = cambio ? { ...v, k: cambio[1] } : v;
    } else out[k] = recolorearLottie(v, cambios);
  }
  return out;
}
