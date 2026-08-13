// El gesto de deslizar para cambiar de pantalla — nunca existió: cambiar de
// pestaña era sólo tocar la barra de abajo.
//
// A propósito NO sigue el dedo en vivo (nada de arrastrar la pantalla con
// vos, como un carrusel). Se mide el gesto completo — dónde empezó, dónde
// terminó — y si fue un swipe horizontal de verdad, recién ahí se cambia de
// pestaña, con la MISMA animación de deslizamiento que ya usa la barra de
// abajo (App.jsx, ORDEN/dir-l/dir-r). Menos vistoso que seguir el dedo, mucho
// más simple y mucho menos riesgo de pelearse con los gestos horizontales que
// YA existen en la app — el carrusel de ejercicios, el cuerpo que gira en
// Inicio, las tiras de chips — que no hay que tocar.
const UMBRAL_PX = 60;          // por debajo de esto, un toque no es un swipe
const RATIO_HORIZONTAL = 1.4;  // cuánto más horizontal que vertical tiene que ser

/* Umbral chico, aparte de UMBRAL_PX. Con touch real el navegador decide MUY
   rápido (bastante antes de los 60px de un swipe hecho y derecho) si el toque
   es un intento de scroll, y si decide que sí, cancela el gesto entero
   (pointercancel en vez de pointerup) — recién ahí App.jsx se entera de que
   hubo un toque, y ya es tarde para leer dónde terminó. Por eso hace falta
   decidir la DIRECCIÓN con mucho menos movimiento que el que hace falta para
   confirmar que fue un swipe: si a los pocos píxeles ya se ve horizontal, hay
   que pedirle al navegador (preventDefault, ver App.jsx) que no se lo lleve
   él antes de que lleguemos al final del gesto. */
const UMBRAL_DIRECCION = 10;

/** Selectores que ya tienen SU PROPIO gesto horizontal. Si el toque empieza
    ahí, este gesto ni se activa — se enumeran acá y no al revés (que cada uno
    avise) porque son gestos de partes bien distintas de la app y no comparten
    ningún módulo en común. */
const EXCLUYE = '.carousel, .sil-stage, .chip-scroll, #restbar, #rest-fs, input, textarea, select, [contenteditable]';

export function empiezaExcluido(target) {
  return !!(target && target.closest && target.closest(EXCLUYE));
}

/** ¿El gesto que terminó fue un swipe horizontal válido?

    Devuelve 1 (avanzar) o -1 (retroceder) — nunca 'izquierda'/'derecha': lo
    que importa es hacia dónde te movés en el orden de pantallas, y esa
    traducción ya la hace quien llama. null si no llegó al umbral o si fue más
    vertical que horizontal — eso es un scroll normal, no una intención de
    cambiar de pantalla. */
export function clasificarSwipe(dx, dy) {
  if (Math.abs(dx) < UMBRAL_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * RATIO_HORIZONTAL) return null;
  return dx < 0 ? 1 : -1;
}

/** true/false/null — ¿ya se puede saber, con poco movimiento, para qué lado
    va el gesto? true = pinta horizontal (reclamarlo antes de que el
    navegador lo cancele). false = pinta vertical (soltarlo, que scrollee
    normal). null = todavía muy poco movimiento para saber. */
export function pintaHorizontal(dx, dy) {
  if (Math.abs(dx) < UMBRAL_DIRECCION && Math.abs(dy) < UMBRAL_DIRECCION) return null;
  return Math.abs(dx) > Math.abs(dy) * RATIO_HORIZONTAL;
}
