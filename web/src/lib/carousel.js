// Puerto de la matemática de posicionamiento del carrusel de ejercicios
// (index.html: initCarousel()/scrollCarouselTo(), dentro de renderHoy()).
//
// DEVIATION documentada respecto al plan (que sólo lista
// components/ExerciseCarousel.jsx para Task 6): esta matemática se extrajo a
// su propio módulo sin dependencias en vez de vivir dentro del componente,
// porque session.js (Task 2) necesita llamar a scrollCarouselTo() después de
// guardar una serie (para saltar al siguiente ejercicio pendiente) y
// ExerciseCarousel.jsx necesita la misma matemática para su posicionamiento
// inicial. Si scrollCarouselTo() viviera en ExerciseCarousel.jsx,
// session.js -> ExerciseCarousel.jsx y ExerciseCarousel.jsx -> session.js
// (éste último para saveSet/ensureVals/etc. de cada slide) formarían un
// import circular — exactamente el tipo de problema que quemó 3 rondas en
// Task 2 (ver task-6-brief.md). Este archivo no importa nada de session.js
// ni de React: es manipulación de DOM pura vía offsetLeft/offsetWidth (NO
// clientWidth — ese fue el bug real corregido en el desarrollo original,
// preservado acá verbatim), así que tanto session.js como
// ExerciseCarousel.jsx lo pueden importar sin crear un ciclo.
export function jumpToSlide(car, idx) {
  if (!car || idx <= 0) return;
  const s = car.children[idx];
  if (s) car.scrollLeft = s.offsetLeft - car.offsetLeft - (car.clientWidth - s.offsetWidth) / 2;
}

export function scrollToSlideEl(car, slide, behavior = 'smooth') {
  if (!car || !slide) return;
  car.scrollTo({ left: slide.offsetLeft - car.offsetLeft - (car.clientWidth - slide.offsetWidth) / 2, behavior });
}

/** Distancia del centro de un slide al centro visible del carrusel — usado
    para decidir qué dot está "activo" mientras el usuario scrollea. */
export function slideCenterDist(car, slide) {
  const center = slide.offsetLeft + slide.offsetWidth / 2 - car.scrollLeft;
  return Math.abs(center - car.clientWidth / 2);
}

/** Puerto de scrollCarouselTo(exId): busca el slide por data-exid dentro de
    #ex-carousel y lo centra con scroll suave, con el mismo delay de 60ms del
    original (deja que el DOM recién insertado/actualizado asiente antes de
    medir offsetLeft). */
export function scrollCarouselTo(exId) {
  const car = document.getElementById('ex-carousel');
  if (!car) return;
  const idx = [...car.children].findIndex(c => c.dataset.exid === exId);
  if (idx >= 0) setTimeout(() => scrollToSlideEl(car, car.children[idx], 'smooth'), 60);
}
