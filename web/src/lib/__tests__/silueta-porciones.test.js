// La silueta de Inicio encendía el GRUPO grueso: un jalón prendía la espalda
// entera, trapecio incluido. Acá se testea el arreglo en sus dos mitades, que
// son las dos formas en que la lámina (bodydata.js) representa una porción:
//
//   - HERMANAS sin base (Espalda: Trapecio / Dorsal alto / Dorsal bajo). Las
//     no entrenadas tienen que quedar APAGADAS y PRESENTES — si se escondieran,
//     el músculo se vería mutilado en vez de parcialmente entrenado.
//   - BASE + PARCHES (Pecho: el pectoral entero con Clavicular/Costal encima).
//
// Y la tercera condición, que es la de CLAUDE.md: un grupo que la lámina NO
// subdivide (bíceps, tríceps, glúteo, gemelos) tiene que comportarse igual que
// antes. Degradar con gracia, no inventarle porciones que no existen.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { diasPorPorcion } from '../fibras.js';
import { claseDeZona } from '../../components/Silhouette.jsx';
import { cabeceraDe } from '../../components/MusclePop.jsx';
import { diasTexto } from '../muscle.js';
import { CUERPOS } from '../bodydata.js';

const zonasDe = (cara, cat) => CUERPOS.m[cara].zonas.filter(z => z.cat === cat);
const HOY = '2026-09-20';

describe('diasPorPorcion', () => {
  it('un jalón dice Dorsal bajo y NO dice nada del trapecio', () => {
    const d = diasPorPorcion([
      { date: '2026-09-19', entries: [{ name: 'Jalón al pecho', sets: [{ w: 60, r: 10 }] }] },
    ], HOY);
    expect(d['Dorsal bajo']).toBe(1);
    // Ausente, no cero: de esa porción no hay registro.
    expect('Trapecio' in d).toBe(false);
    expect('Dorsal alto' in d).toBe(false);
  });

  it('cada porción lleva su propia fecha, la más reciente', () => {
    const d = diasPorPorcion([
      { date: '2026-09-13', entries: [{ name: 'Encogimientos', sets: [{}] }] },
      { date: '2026-09-18', entries: [{ name: 'Remo neutro', sets: [{}] }] },
      { date: '2026-09-20', entries: [{ name: 'Jalón ancho', sets: [{}] }] },
    ], HOY);
    expect(d).toEqual({ Trapecio: 7, 'Dorsal alto': 2, 'Dorsal bajo': 0 });
  });

  it('sólo cuentan las porciones principales: el bíceps del jalón es asistencia', () => {
    const d = diasPorPorcion([
      { date: '2026-09-19', entries: [{ name: 'Jalón al pecho', sets: [{}] }] },
    ], HOY);
    expect(Object.keys(d)).toEqual(['Dorsal bajo']);
  });

  it('un ejercicio en la lista pero sin series hechas no cuenta', () => {
    expect(diasPorPorcion([
      { date: '2026-09-19', entries: [{ name: 'Jalón al pecho', sets: [] }] },
    ], HOY)).toEqual({});
  });

  it('un nombre que fibras.js no reconoce no inventa porción', () => {
    expect(diasPorPorcion([
      { date: '2026-09-19', entries: [{ name: 'Máquina rara del gimnasio nuevo', sets: [{}] }] },
    ], HOY)).toEqual({});
  });

  it('las porciones sin forma propia en la lámina no entran (se pintan con su grupo)', () => {
    // 'Bíceps braquial' es una porción real, pero la lámina dibuja el brazo de
    // una sola pieza: si entrara acá, la silueta buscaría una zona que no
    // existe y el bíceps se quedaría sin encender.
    const d = diasPorPorcion([
      { date: '2026-09-19', entries: [{ name: 'Curl con barra', sets: [{}] }] },
    ], HOY);
    expect(d).toEqual({});
  });

  it('no explota sin sesiones, sin entradas ni sin fecha', () => {
    expect(diasPorPorcion(undefined, HOY)).toEqual({});
    expect(diasPorPorcion([{}], HOY)).toEqual({});
    expect(diasPorPorcion([{ entries: [{ name: 'Jalón', sets: [{}] }] }], HOY)).toEqual({});
  });
});

describe('claseDeZona — hermanas (Espalda, sin músculo base)', () => {
  const hermanas = [
    ...zonasDe('espalda', 'Espalda'),
  ].filter(z => z.sub && !z.parche);
  const buscar = sub => hermanas.find(z => z.sub === sub);

  it('la lámina tiene las tres hermanas de Espalda y ninguna es parche', () => {
    expect(hermanas.map(z => z.sub).sort()).toEqual(['Dorsal alto', 'Dorsal bajo', 'Trapecio']);
  });

  it('sólo la porción entrenada se enciende; las hermanas quedan apagadas', () => {
    const days = { Espalda: 1 };
    const porciones = { 'Dorsal bajo': 1 };
    expect(claseDeZona(buscar('Dorsal bajo'), days, porciones)).toBe('sil-d0');
    expect(claseDeZona(buscar('Trapecio'), days, porciones)).toBe('sil-none');
    expect(claseDeZona(buscar('Dorsal alto'), days, porciones)).toBe('sil-none');
  });

  it('una hermana entrenada hace tiempo lleva SU frescura, no la del grupo', () => {
    // El grupo entero es "hace 1 día" por el jalón, pero el trapecio hace 9.
    const cls = claseDeZona(buscar('Trapecio'), { Espalda: 1 }, { 'Dorsal bajo': 1, Trapecio: 9 });
    expect(cls).toBe('sil-d3');
  });

  it('sin la prop porciones se comporta EXACTAMENTE como antes: todo el grupo', () => {
    for (const z of hermanas) expect(claseDeZona(z, { Espalda: 1 })).toBe('sil-d0');
  });
});

describe('claseDeZona — base + parches (Pecho)', () => {
  const pecho = zonasDe('frente', 'Pecho');
  const base = pecho.filter(z => !z.sub);
  const parches = pecho.filter(z => z.parche);

  it('la lámina tiene un pecho base y sus dos parches', () => {
    expect(base.length).toBeGreaterThan(0);
    expect(parches.map(z => z.sub).sort()).toEqual(['Clavicular', 'Costal']);
  });

  it('el músculo base sigue llevando el tono del grupo: no se apaga lo que sí se trabajó', () => {
    for (const z of base) expect(claseDeZona(z, { Pecho: 2 }, { Clavicular: 2 })).toBe('sil-d1');
  });

  it('el parche entrenado lleva su propia frescura', () => {
    const clav = parches.find(z => z.sub === 'Clavicular');
    expect(claseDeZona(clav, { Pecho: 0 }, { Clavicular: 5 })).toBe('sil-d2');
  });
});

describe('claseDeZona — grupos que la lámina no subdivide', () => {
  // Bíceps, Tríceps, Glúteo y Gemelos no tienen NINGUNA zona con `sub`: la
  // lámina no los divide y no se les inventan franjas (ver HANDOFF.md, deuda
  // 10). Pasarles porciones no puede cambiarles nada.
  for (const [cara, cat] of [['frente', 'Bíceps'], ['frente', 'Tríceps'], ['espalda', 'Glúteo'], ['frente', 'Gemelos']]) {
    it(`${cat} no tiene subzonas y se enciende entero, con o sin porciones`, () => {
      const zonas = zonasDe(cara, cat);
      expect(zonas.length).toBeGreaterThan(0);
      expect(zonas.every(z => !z.sub)).toBe(true);
      for (const z of zonas) {
        expect(claseDeZona(z, { [cat]: 0 })).toBe('sil-d0');
        expect(claseDeZona(z, { [cat]: 0 }, { 'Dorsal bajo': 1 })).toBe('sil-d0');
      }
    });
  }

  it('un grupo sin registro sigue neutro y callado, no en cero', () => {
    const z = zonasDe('frente', 'Gemelos')[0];
    expect(claseDeZona(z, { Gemelos: null }, {})).toBe('sil-none');
  });
});

// La figura encendía porciones pero la ficha seguía hablando del grupo grueso:
// tocabas el trapecio pintado gris de "nunca" y la cabecera decía "Espalda ·
// hoy". Acá se fija la regla: la cabecera habla de LO QUE TOCASTE.
describe('MusclePop — la cabecera habla de la porción tocada', () => {
  const HOY_ = '2026-09-20';
  const sesiones = [
    { date: '2026-09-20', entries: [{ name: 'Jalón al pecho', sets: [{ w: 60, r: 10 }] }] },
    { date: '2026-09-14', entries: [{ name: 'Remo neutro', sets: [{ w: 50, r: 10 }] }] },
  ];
  const porciones = diasPorPorcion(sesiones, HOY_);

  it('una porción SIN registro dice nunca, no el "hoy" del grupo', () => {
    // El grupo Espalda es "hoy" por el jalón; el trapecio no se entrenó nunca.
    const h = cabeceraDe('Espalda', 0, { nombre: 'Trapecio', dias: porciones['Trapecio'] ?? null });
    expect(h.nombre).toBe('Espalda · trapecio');
    expect(h.dias).toBe(null);
    expect(diasTexto(h.dias)).toBe('nunca');
  });

  it('una porción CON registro lleva sus propios días, distintos de los del grupo', () => {
    const h = cabeceraDe('Espalda', 0, { nombre: 'Dorsal alto', dias: porciones['Dorsal alto'] });
    expect(h.nombre).toBe('Espalda · dorsal alto');
    expect(h.dias).toBe(6);
    expect(diasTexto(h.dias)).toBe('hace 6 días');
    // El grupo, en cambio, es "hoy": son dos datos distintos a propósito.
    expect(diasTexto(0)).toBe('hoy');
  });

  it('una zona sin subdivisión se comporta EXACTAMENTE como antes', () => {
    // Bíceps/Glúteo/Gemelos: la lámina no los divide, así que no llega porción
    // y la cabecera es la de siempre. No-regresión.
    expect(cabeceraDe('Glúteo', 3)).toEqual({ nombre: 'Glúteo', dias: 3 });
    expect(cabeceraDe('Gemelos', null)).toEqual({ nombre: 'Gemelos', dias: null });
  });

  it('el músculo base de un grupo con parches es el grupo, no una porción', () => {
    // El pecho fuera de la zona clavicular no tiene `sub`: Silhouette no manda
    // porción y la ficha resume el grupo entero.
    expect(cabeceraDe('Pecho', 2, null)).toEqual({ nombre: 'Pecho', dias: 2 });
  });
});

describe('MusclePop — el sub tocado viaja desde la silueta', () => {
  const sil = readFileSync(new URL('../../components/Silhouette.jsx', import.meta.url), 'utf8');
  const pop = readFileSync(new URL('../../components/MusclePop.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('sin la prop porciones no se manda ningún sub: el toque es del grupo', () => {
    expect(sil).toMatch(/onPick\(z\.cat, porciones \? z\.sub : null/);
  });

  it('la ficha recibe la porción con SU frescura, y null cuando no hay registro', () => {
    expect(sil).toMatch(/porcion=\{sel\.sub \? \{ nombre: sel\.sub, dias: porciones\?\.\[sel\.sub\] \?\? null \} : null\}/);
  });

  it('el realce del desglose usa una clase que existe de verdad en styles.css', () => {
    expect(pop).toMatch(/mpop-fibra\$\{porcion && f\.fibra === porcion\.nombre \? ' on' : ''\}/);
    expect(css).toMatch(/\.mpop-fibra\.on>\.mpop-fibra-nombre\{/);
  });
});

// El mapa grande (sheets/BodyMap.jsx) es el otro consumidor de esto. Lo que se
// puede testear sin navegador es el contrato: que el markup pida las porciones,
// que la clase de recalibrado del contorno exista de verdad en styles.css (una
// clase muerta no falla y no avisa — ver CLAUDE.md) y que no se le haya colado
// un valor suelto donde va la variable.
describe('BodyMap — el mapa grande recibe las porciones', () => {
  const src = readFileSync(new URL('../../components/sheets/BodyMap.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('calcula las porciones del historial y se las pasa a la silueta', () => {
    expect(src).toMatch(/diasPorPorcion\(S\.sessions, dstr\(\)\)/);
    expect(src).toMatch(/<Silhouette[^>]*porciones=\{porciones\}/);
  });

  it('marca el contenedor como grande para recalibrar el contorno', () => {
    expect(src).toMatch(/className="sil-grande/);
    expect(css).toMatch(/\.sil-grande\{--sil-porcion-w:/);
    // El contorno tiene que LEER la variable: si alguien vuelve a un número
    // suelto, el mapa grande se queda con el grosor de la miniatura.
    expect(css).toMatch(/\.sil-porcion\{[^}]*stroke-width:var\(--sil-porcion-w,\s*2\)/);
  });

  it('la aclaración de la leyenda sólo sale si hay alguna porción con registro', () => {
    // Sin dato no hay nada distinto que explicar, y un texto fijo prometería un
    // detalle que la figura no está mostrando.
    expect(src).toMatch(/Object\.keys\(porciones\)\.length > 0 &&/);
  });
});
