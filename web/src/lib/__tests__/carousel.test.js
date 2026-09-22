/* Regresión del bug "al pasar de ejercicio la tarjeta queda desalineada"
   (2026-09-21).

   El test NO usa un DOM real: jsdom devuelve 0 en offsetLeft/offsetWidth/
   clientWidth, así que no podría ver nada de esto. Se arman objetos falsos con
   exactamente los números MEDIDOS en Chrome a 390px sobre la app real, que es
   lo que hace que el test signifique algo:
     car.clientWidth 386, car.offsetLeft 2, car.scrollWidth 3555
     slide[1].offsetLeft 375, slide[2].offsetLeft 727, offsetWidth 340
   y el punto de snap real al que el navegador dejaba el carrusel: 352 y 704.
   La cuenta vieja daba 350 y 702 — dos píxeles menos, los mismos dos píxeles
   de car.offsetLeft que restaba de más. */
import { describe, it, expect } from 'vitest';
import { slideScrollLeft, jumpToSlide, scrollToSlideEl } from '../carousel.js';

function carrusel() {
  const car = { clientWidth: 386, offsetLeft: 2, scrollWidth: 3555, scrollLeft: 0, children: [] };
  car.children = [23, 375, 727, 1079].map(offsetLeft => ({ offsetLeft, offsetWidth: 340, offsetParent: car }));
  car.scrollTo = o => { car.ultimoScrollTo = o; };
  return car;
}

describe('slideScrollLeft', () => {
  it('apunta al punto de snap REAL, no dos píxeles antes', () => {
    const car = carrusel();
    expect(slideScrollLeft(car, car.children[1])).toBe(352);
    expect(slideScrollLeft(car, car.children[2])).toBe(704);
  });

  it('no resta la posición del carrusel en la página (offsetLeft del slide ya es relativo al carrusel)', () => {
    const car = carrusel();
    const antes = slideScrollLeft(car, car.children[2]);
    car.offsetLeft = 120; // el carrusel se corrió en la página: el destino no cambia
    expect(slideScrollLeft(car, car.children[2])).toBe(antes);
  });

  it('si el offsetParent NO es el carrusel, sí hay que descontar su posición', () => {
    const car = carrusel();
    const otro = {};
    const slide = { offsetLeft: 727 + 2, offsetWidth: 340, offsetParent: otro };
    expect(slideScrollLeft(car, slide)).toBe(704);
  });

  it('el primer slide no pide un scroll negativo', () => {
    const car = carrusel();
    expect(slideScrollLeft(car, car.children[0])).toBe(0);
  });

  it('el último slide no pide más scroll del que existe', () => {
    const car = carrusel();
    const max = car.scrollWidth - car.clientWidth;
    car.children.push({ offsetLeft: 3200, offsetWidth: 340, offsetParent: car });
    expect(slideScrollLeft(car, car.children.at(-1))).toBe(max);
  });
});

describe('jumpToSlide / scrollToSlideEl', () => {
  it('jumpToSlide deja el scrollLeft exacto, sin animar', () => {
    const car = carrusel();
    jumpToSlide(car, 2);
    expect(car.scrollLeft).toBe(704);
    expect(car.ultimoScrollTo).toBeUndefined();
  });

  it('jumpToSlide ignora idx<=0: no hace falta reposicionar hacia el principio', () => {
    const car = carrusel();
    jumpToSlide(car, 0);
    jumpToSlide(car, -1);
    expect(car.scrollLeft).toBe(0);
  });

  it('scrollToSlideEl pide UN scroll suave al mismo destino', () => {
    const car = carrusel();
    scrollToSlideEl(car, car.children[2], 'smooth');
    expect(car.ultimoScrollTo).toEqual({ left: 704, behavior: 'smooth' });
  });

  it('acepta behavior auto para las correcciones de layout (no es una navegación)', () => {
    const car = carrusel();
    scrollToSlideEl(car, car.children[1], 'auto');
    expect(car.ultimoScrollTo).toEqual({ left: 352, behavior: 'auto' });
  });

  it('sin carrusel o sin slide no explota', () => {
    expect(() => scrollToSlideEl(null, null)).not.toThrow();
    expect(() => jumpToSlide(null, 2)).not.toThrow();
  });
});
