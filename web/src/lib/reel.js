// Matemática pura del selector de rueda por gestos (peso/reps en Hoy). Mismo
// patrón que carousel.js: sin dependencias de React, sólo offsetLeft/
// clientWidth (nunca clientWidth donde corresponde offsetWidth — ver la nota
// de carousel.js sobre ese bug real).
//
// La rueda es scroll-snap nativo (igual que .carousel): cada "diente" es un
// valor válido (múltiplo de `step`, nunca negativo), centrado bajo un
// indicador fijo. Arrastrar/flickear es 100% gesto del navegador — no hay
// spring ni rAF en JS, por la misma razón que se documentó para el resto de
// la app (se probó Framer Motion para esto y perdía cuadros en el teléfono
// real).

/** Genera `count` valores centrados en `center`, redondeados a múltiplos de
    `step` y nunca por debajo de `min`. Impar para que haya un diente central
    exacto. */
export function reelValues(center, step, min = 0, count = 41) {
  const half = Math.floor(count / 2);
  const base = Math.round(center / step) * step;
  const out = [];
  for (let i = -half; i <= half; i++) {
    const v = Math.max(min, base + i * step);
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** Centra instantáneamente (sin scroll suave, para no pelear con el gesto
    del usuario en cada re-render) el diente `idx` bajo el indicador. */
export function reelCenter(scroller, idx) {
  const item = scroller?.children?.[idx];
  if (!scroller || !item) return;
  scroller.scrollLeft = item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2;
}

/** Índice del diente más cercano al centro visible, para leer el valor tras
    el gesto (scroll nativo, sin listener continuo de posición). */
export function reelNearestIndex(scroller) {
  if (!scroller) return -1;
  const mid = scroller.scrollLeft + scroller.clientWidth / 2;
  let best = -1, bestDist = Infinity;
  [...scroller.children].forEach((item, i) => {
    const c = item.offsetLeft + item.offsetWidth / 2;
    const d = Math.abs(c - mid);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}
