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
    del usuario en cada re-render) el diente `idx` bajo el indicador.
    `axis='y'` es lo mismo pero para la rueda fina vertical (mantener
    presionado — ver ReelPicker.jsx): mismo mecanismo de scroll-snap nativo,
    sólo cambia qué eje se lee/escribe. */
export function reelCenter(scroller, idx, axis = 'x') {
  const item = scroller?.children?.[idx];
  if (!scroller || !item) return;
  if (axis === 'y') {
    scroller.scrollTop = item.offsetTop - (scroller.clientHeight - item.offsetHeight) / 2;
  } else {
    scroller.scrollLeft = item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2;
  }
}

/** Índice del diente más cercano al centro visible, para leer el valor tras
    el gesto (scroll nativo, sin listener continuo de posición). */
export function reelNearestIndex(scroller, axis = 'x') {
  if (!scroller) return -1;
  const mid = axis === 'y'
    ? scroller.scrollTop + scroller.clientHeight / 2
    : scroller.scrollLeft + scroller.clientWidth / 2;
  let best = -1, bestDist = Infinity;
  [...scroller.children].forEach((item, i) => {
    const c = axis === 'y'
      ? item.offsetTop + item.offsetHeight / 2
      : item.offsetLeft + item.offsetWidth / 2;
    const d = Math.abs(c - mid);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}
