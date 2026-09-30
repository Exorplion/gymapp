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
export function reelValues(center: number, step: number, min = 0, count = 41): number[] {
  const half = Math.floor(count / 2);
  const base = Math.round(center / step) * step;
  // El arranque se CORRE hacia arriba cuando el centro está pegado al piso,
  // en vez de recortar cada valor con Math.max(min, ...). Recortar producía
  // dientes repetidos: con min=1 y el peso en 1, los 20 dientes de la
  // izquierda daban todos "1" — la rueda parecía trabada en un 1 que se
  // repetía muchas veces (Enzo, sesión en vivo). Corriendo el arranque, la
  // ventana sigue teniendo `count` dientes, todos distintos, y el piso es de
  // verdad el último valor hacia abajo.
  // El piso se redondea HACIA ARRIBA al primer múltiplo de `step`: los
  // dientes de la rueda gruesa siguen siendo todos múltiplos (2.5, 5, 7.5…)
  // aunque el mínimo real sea 0.5 kg. La rueda fina (step 1) es la que baja
  // al kilo exacto.
  const piso = Math.ceil(min / step - 1e-9) * step;
  const start = Math.max(piso, base - half * step);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.round((start + i * step) * 100) / 100);
  }
  return out;
}

/** Centra instantáneamente (sin scroll suave, para no pelear con el gesto
    del usuario en cada re-render) el diente `idx` bajo el indicador.
    `axis='y'` es lo mismo pero para la rueda fina vertical (mantener
    presionado — ver ReelPicker.jsx): mismo mecanismo de scroll-snap nativo,
    sólo cambia qué eje se lee/escribe. */
export function reelCenter(scroller: HTMLElement | null | undefined, idx: number, axis: 'x' | 'y' = 'x'): void {
  const item = scroller?.children?.[idx] as HTMLElement | undefined;
  if (!scroller || !item) return;
  if (axis === 'y') {
    scroller.scrollTop = item.offsetTop - (scroller.clientHeight - item.offsetHeight) / 2;
  } else {
    /* Sin leer el layout (H7). Antes: offsetLeft + clientWidth + offsetWidth,
       justo después de que React escribió el DOM de la serie nueva: el
       navegador tenía que recalcular estilo y layout de la página entera en
       el medio del commit (~170 ms a 6× por serie registrada). Con dientes
       de ancho fijo y el relleno de la pista en calc(50% − diente/2), el
       diente `idx` queda centrado exactamente en idx × diente: la cuenta no
       depende de nada que haya que medir. La escritura de scrollLeft sigue
       costando un layout si el árbol está sucio, por eso ReelPicker sólo
       llama acá cuando el valor cambió de verdad. */
    scroller.scrollLeft = reelScrollLeft(idx);
  }
}

/** Ancho de un diente de la rueda gruesa, en px. Es `--reel-diente` de
    styles.css (un test los mantiene iguales): la pista rellena
    calc(50% − diente/2) de cada lado, así que el diente `idx` se centra con
    scrollLeft = idx × diente, sin medir nada. */
export const REEL_DIENTE = 44;

export function reelScrollLeft(idx: number): number {
  return Math.max(0, idx) * REEL_DIENTE;
}

/** Índice del diente más cercano al centro visible, para leer el valor tras
    el gesto (scroll nativo, sin listener continuo de posición). */
export function reelNearestIndex(scroller: HTMLElement | null | undefined, axis: 'x' | 'y' = 'x'): number {
  if (!scroller) return -1;
  if (axis === 'x') {
    // Misma cuenta que reelScrollLeft, al revés: una sola lectura (scrollLeft)
    // en vez de offsetLeft/offsetWidth de los 41 dientes.
    const n = scroller.children.length;
    if (!n) return -1;
    return Math.min(n - 1, Math.max(0, Math.round(scroller.scrollLeft / REEL_DIENTE)));
  }
  const mid = axis === 'y'
    ? scroller.scrollTop + scroller.clientHeight / 2
    : scroller.scrollLeft + scroller.clientWidth / 2;
  let best = -1, bestDist = Infinity;
  [...scroller.children].forEach((item, i) => {
    const el = item as HTMLElement;
    const c = axis === 'y'
      ? el.offsetTop + el.offsetHeight / 2
      : el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(c - mid);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}
