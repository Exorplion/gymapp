// detailsSlide() es la pieza que le da movimiento al <details> de "más
// opciones" de la sesión SIN dejar de ser un <details>. Lo que se puede
// verificar sin navegador es justamente lo delicado: que el `open` termine
// donde corresponde (somos nosotros los que ahora lo escribimos, porque el
// toggle nativo está frenado con preventDefault), y que con "reducir
// movimiento" abra y cierre de una, como hacía el navegador solo.
//
// El orden importa y por eso se testea: al ABRIR hay que poner open=true
// ANTES de animar (sin nodo en el layout no hay altura que medir), y al
// CERRAR recién DESPUÉS (con open=false ya no hay contenido). Invertir
// cualquiera de los dos deja el acordeón roto de una forma que ningún test
// de render habría visto.
//
// No hay jsdom en este proyecto (los tests corren en node pelado), así que
// el <details> se falsea con dos objetos que exponen lo poco que la función
// toca: `open`, `animate`, `offsetHeight` y `style`.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { detailsSlide, D } from '../motion.js';

const ruta = (rel) => new URL(rel, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fuente = (rel) => readFileSync(ruta(rel), 'utf8');

function fakeDetails() {
  const animaciones = [];
  const body = {
    offsetHeight: 120,
    style: { cssText: '' },
    animate(keyframes, opts) {
      const a = { keyframes, opts, oncancel: null, onfinish: null, cancel() { a.oncancel?.(); } };
      animaciones.push(a);
      return a;
    },
  };
  return { det: { open: false }, body, animaciones };
}

/** matchMedia no existe en node; menosMovimiento() lo chequea con `typeof`,
    así que por defecto devuelve false (= hay movimiento). Para el caso
    contrario se planta uno que dice que sí. */
function pedirMenosMovimiento(valor) {
  globalThis.matchMedia = () => ({ matches: valor });
}

afterEach(() => { delete globalThis.matchMedia; });

describe('detailsSlide — el estado abierto/cerrado', () => {
  beforeEach(() => { delete globalThis.matchMedia; });

  it('al abrir pone open=true antes de animar (si no, no hay altura que medir)', () => {
    const { det, body, animaciones } = fakeDetails();
    detailsSlide(det, body);
    expect(det.open).toBe(true);
    expect(animaciones).toHaveLength(1);
    const [desde, hasta] = animaciones[0].keyframes;
    expect(desde.height).toBe('0px');
    expect(hasta.height).toBe('120px');
    expect(desde.opacity).toBe(0);
  });

  it('al cerrar anima primero y recién al terminar pone open=false', () => {
    const { det, body, animaciones } = fakeDetails();
    det.open = true;
    detailsSlide(det, body);
    // Todavía abierto: el contenido tiene que seguir ahí mientras se pliega.
    expect(det.open).toBe(true);
    const [desde, hasta] = animaciones[0].keyframes;
    expect(desde.height).toBe('120px');
    expect(hasta.height).toBe('0px');
    animaciones[0].onfinish();
    expect(det.open).toBe(false);
  });

  it('usa D.objeto: esto se abre 15-30 veces por sesión, no puede ser lento', () => {
    const { det, body, animaciones } = fakeDetails();
    detailsSlide(det, body);
    expect(animaciones[0].opts.duration).toBe(D.objeto);
    expect(D.objeto).toBeLessThan(D.panel);
  });

  it('restaura el style del cuerpo al terminar (el overflow:hidden era prestado)', () => {
    const { det, body, animaciones } = fakeDetails();
    body.style.cssText = 'color:red';
    detailsSlide(det, body);
    expect(body.style.overflow).toBe('hidden');
    animaciones[0].onfinish();
    expect(body.style.cssText).toBe('color:red');
  });

  it('un toggle rápido cancela la animación anterior en vez de encimarla', () => {
    const { det, body, animaciones } = fakeDetails();
    detailsSlide(det, body);          // abre
    detailsSlide(det, body);          // cierra antes de que termine
    expect(animaciones).toHaveLength(2);
    // La primera recibió cancel(): su limpieza corrió (oncancel estaba puesto).
    expect(animaciones[0].oncancel).toBeTypeOf('function');
  });
});

describe('detailsSlide — gate de movimiento reducido', () => {
  it('con reducir movimiento abre instantáneo y no anima', () => {
    pedirMenosMovimiento(true);
    const { det, body, animaciones } = fakeDetails();
    detailsSlide(det, body);
    expect(det.open).toBe(true);
    expect(animaciones).toHaveLength(0);
    // Y cierra igual de instantáneo: el `open` lo escribimos nosotros, así
    // que salir sin hacer nada dejaría el acordeón trabado.
    detailsSlide(det, body);
    expect(det.open).toBe(false);
    expect(animaciones).toHaveLength(0);
  });

  it('sin Web Animations API tampoco se traba', () => {
    pedirMenosMovimiento(false);
    const det = { open: false };
    detailsSlide(det, { style: {} });
    expect(det.open).toBe(true);
  });
});

/* 2026-09-24: el acordeón "Más opciones del ejercicio" se fue. Enzo: estaba
   al fondo de la tarjeta y si no scrolleabas no sabías que existía. Las
   opciones son ahora un botón arriba, con nombre, que abre una hoja (un
   diálogo de verdad: foco atrapado, Escape, anuncio — Sheet.jsx). Estas
   guardias fijan eso para que no vuelva a esconderse. detailsSlide() sigue en
   motion.js y testeado arriba, por si otro acordeón lo necesita. */
describe('las opciones del ejercicio están a la vista', () => {
  const jsx = fuente('../../components/ExerciseCarousel.jsx');

  it('es un botón con nombre accesible que abre la hoja de opciones', () => {
    expect(jsx).toMatch(/className="ex-opts"/);
    expect(jsx).toMatch(/aria-label=\{`Opciones de \$\{ex\.name\}`\}/);
    expect(jsx).toMatch(/openSheet\('ex-opciones'/);
  });

  it('no volvió el acordeón al fondo ni el bloomOpen encima', () => {
    expect(jsx).not.toMatch(/<details/);
    expect(jsx).not.toMatch(/bloomOpen/);
  });

  it('la clase existe en styles.css (una clase muerta no avisa)', () => {
    const css = fuente('../../styles.css');
    for (const c of ['ex-opts', 'ex-cmp', 'ex-seg', 'ex-aprox', 'ex-live', 'exh', 'ex-tag', 'ex-foto']) {
      expect(css, c).toMatch(new RegExp(`\\.${c}[{ ,.:]`));
    }
  });
});
