// Matemática de posicionamiento del carrusel de ejercicios
// (index.html: initCarousel()/scrollCarouselTo(), dentro de renderHoy()).
//
// Vive en su propio módulo sin dependencias —ni React, ni session.js— porque
// originalmente session.js también la usaba para saltar al siguiente
// ejercicio después de guardar una serie, y un import directo
// session.js <-> ExerciseCarousel.jsx habría sido un ciclo. Eso YA NO pasa:
// hoy el único dueño del scroll del carrusel es ExerciseCarousel.jsx (ver
// abajo). El módulo se mantiene aparte igual porque es DOM puro y se testea
// sin montar nada.
//
// POR QUÉ EL CARRUSEL ES EL ÚNICO QUE SCROLLEA (bug 2026-09-21, Enzo: "al
// terminar un EJERCICIO hace la animación pero no la completa y la tarjeta
// queda desalineada"): antes había DOS scrolls suaves para la misma
// transición — el useLayoutEffect de ExerciseCarousel (que reacciona al
// cambio de `curId`) y un scrollCarouselTo() con setTimeout(60) disparado
// por saveSet()/startExercise(). Cuando los dos caían juntos, Chrome
// reiniciaba la animación de scroll suave a mitad de camino y el carrusel
// se pasaba de largo: medido a 390px, quedó en scrollLeft 385.6 con el
// slide 33.6px corrido del centro, y así se quedó 1.4s hasta que
// scroll-snap lo arrastró de vuelta a 352. Ese arrastre tardío es el
// "rebote" que se veía. Un solo scroll programático, un solo dueño.
//
// Se usa offsetLeft/offsetWidth y NO getBoundingClientRect() a propósito:
// los slides llevan un `transform` de coverflow (rotateY + scale) y el rect
// visual está escalado, así que mediría mal. offsetLeft/offsetWidth son
// layout puro, inmunes al transform.

/** offsetLeft de un slide EN COORDENADAS DEL CARRUSEL.
 *
 *  offsetLeft se mide contra offsetParent, y para los slides de un
 *  contenedor con overflow el offsetParent es el propio contenedor: el
 *  número ya viene en el espacio de scroll del carrusel. Restarle
 *  `car.offsetLeft` —lo que hacía esta matemática antes— le sacaba de más
 *  exactamente la posición del carrusel en la página. Medido a 390px:
 *  slide.offsetLeft 727, car.offsetLeft 2 → apuntaba a 702 cuando el punto
 *  de snap real era 704. Dos píxeles que no se ven como error de dos
 *  píxeles: scroll-snap tiene que corregirlos DESPUÉS de que terminó la
 *  animación, y esa corrección tardía es la que se lee como "la tarjeta se
 *  acomoda sola un rato después".
 *
 *  El fallback (restar car.offsetLeft) queda para el caso en que el
 *  offsetParent no sea el carrusel — no pasa en Chrome, pero la cuenta no
 *  puede depender de adivinarlo. */
function slideOffsetInCar(car, slide) {
  return slide.offsetParent === car ? slide.offsetLeft : slide.offsetLeft - car.offsetLeft;
}

/** scrollLeft exacto que deja `slide` centrado, acotado al rango scrolleable
    (pedir el centrado del primer o el último slide da un número fuera de
    rango, y el navegador lo recorta igual: mejor recortarlo acá para que el
    resto del código pueda comparar contra el destino real). */
export function slideScrollLeft(car, slide) {
  const raw = slideOffsetInCar(car, slide) - (car.clientWidth - slide.offsetWidth) / 2;
  return Math.max(0, Math.min(raw, car.scrollWidth - car.clientWidth));
}

export function jumpToSlide(car, idx) {
  if (!car || idx <= 0) return;
  const s = car.children[idx];
  if (s) car.scrollLeft = slideScrollLeft(car, s);
}

export function scrollToSlideEl(car, slide, behavior = 'smooth') {
  if (!car || !slide) return;
  car.scrollTo({ left: slideScrollLeft(car, slide), behavior });
}

/** Distancia del centro de un slide al centro visible del carrusel — usado
    para decidir qué dot está "activo" mientras el usuario scrollea. */
export function slideCenterDist(car, slide) {
  const center = slide.offsetLeft + slide.offsetWidth / 2 - car.scrollLeft;
  return Math.abs(center - car.clientWidth / 2);
}
