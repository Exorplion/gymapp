// La rampa de aproximación como estado puro (rediseño 2026-09-27, pieza 2).
//
// Sin S ni DOM: qué paso está hecho, cuál toca, cuánto se llena la línea,
// qué hace tocar un círculo y qué dice el botón grande de la tarjeta. El
// avance real vive en el borrador de la sesión (pasosRampa / avanzarRampa /
// deshacerRampa, en session.js); acá sólo se decide qué significa.
import { round1, fmtNum } from './format.js';

const pesoPorDefecto = kg => fmtNum(round1(kg));
const pctTexto = pct => `${Math.round(pct * 100)} %`;

/** Pasos hechos, siempre un entero entre 0 y n. Un valor roto del borrador
    (texto, negativo, NaN) cuenta como "ninguno", no como un error. */
export function clampHechos(hechos, n) {
  const h = Math.floor(Number(hechos));
  if (!(h > 0) || !(n > 0)) return 0;
  return Math.min(h, n);
}

/** Cuánto de la línea entre círculos está lleno (0..1). Con el paso 1 hecho
    la línea llega al segundo círculo: antes la cuenta era (hechos-1)/(n-1)
    y el primer toque no la movía (relevamiento, zona B). */
export function avanceLinea(hechos, n) {
  if (!(n > 1)) return 0;
  return Math.min(clampHechos(hechos, n), n - 1) / (n - 1);
}

/** El estado de cada paso para pintar los círculos. */
export function estadoRampa(rampa, hechos) {
  const lista = Array.isArray(rampa) ? rampa : [];
  const n = lista.length;
  const h = clampHechos(hechos, n);
  return {
    n,
    hechos: h,
    activo: h < n ? h : null,
    completa: n > 0 && h >= n,
    avance: avanceLinea(h, n),
    pasos: lista.map((s, i) => ({ ...s, estado: i < h ? 'hecho' : i === h ? 'activo' : 'futuro' })),
  };
}

/** Qué pasa al tocar el círculo `i`. Hacia atrás deshace (vuelve a ese
    paso); hacia adelante no se puede saltar — la UI sacude el activo como
    pista de "primero este"; el activo lo avanza el botón, no el círculo.
    Con la rampa completa no hace nada: el bloque ya quedó calentado. */
export function tocarPaso(hechos, i, n) {
  const h = clampHechos(hechos, n);
  if (h >= n || !Number.isInteger(i) || i < 0 || i >= n) return { accion: 'nada', hechos: h };
  if (i < h) return { accion: 'deshacer', hechos: i };
  if (i > h) return { accion: 'sacudir', hechos: h };
  return { accion: 'nada', hechos: h };
}

/** Lo que dice el botón grande (`.btn-serie`). Mientras quedan
    aproximaciones, la que toca ("Aprox. 50 % lista", "25 kg × 5"); después,
    la serie de siempre. El texto va en caja normal: las mayúsculas las pone
    el CSS de `.btn-serie-t`. `fmtPeso` recibe kg (en la tarjeta, wDisplay). */
export function estadoBoton({ rampa = [], hechos = 0, serie, unidad = 'kg', fmtPeso = pesoPorDefecto }) {
  const n = Array.isArray(rampa) ? rampa.length : 0;
  const h = clampHechos(hechos, n);
  if (h < n) {
    const s = rampa[h];
    return { variante: 'aprox', paso: h, texto: `Aprox. ${pctTexto(s.pct)} lista`, valor: `${fmtPeso(s.w)} ${unidad} × ${s.reps}` };
  }
  return { variante: 'serie', paso: null, texto: `${serie.etiqueta} lista`, valor: `${fmtPeso(serie.w)} ${unidad} × ${serie.r}` };
}
