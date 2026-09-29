// Guardia contra la regresión más fácil de cometer en esta app: agregar un
// botón que dice sólo "✕" y olvidarse del nombre accesible. No es una
// auditoría de accesibilidad —eso no se automatiza— es una red para UN error
// concreto y repetido, del mismo espíritu que el test de los 18 ejercicios
// reales de Enzo en muscle.test.js: el caso que de verdad falló es el test.
//
// Se lee el JSX como texto a propósito. Montar los 27 sheets pediría
// @testing-library, jsdom y un IndexedDB falso para algo que se responde
// mirando el markup.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EquipIcon from '../../components/EquipIcon.jsx';
import { EQUIP_ASIST } from '../equip.js';
import { S } from '../state.js';
import AgregarEjercicio from '../../components/sheets/AgregarEjercicio.jsx';
import { estadoInicial, setNombre, avanzar, NUEVO } from '../asistente-agregar.js';

const RAIZ = new URL('../../components', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function jsxDeTodoElArbol(dir) {
  const out = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...jsxDeTodoElArbol(ruta));
    else if (nombre.endsWith('.jsx')) out.push(ruta);
  }
  return out;
}

/* Glifos que la app usa COMO ícono. Un botón cuyo contenido entero es uno de
   estos no dice nada por sí solo: "✕" leído en voz alta es "equis". */
const GLIFOS = '✕✎✓↑↓↕↺‹›☰−+ⓘ';
const BOTON_SOLO_GLIFO = new RegExp(`<button\\b([^>]*)>\\s*[${GLIFOS}]\\s*</button>`, 'g');

describe('botones sólo-ícono', () => {
  const archivos = jsxDeTodoElArbol(RAIZ);

  it('encuentra archivos para revisar (si esto falla, la ruta se rompió)', () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  it('todos tienen nombre accesible (aria-label o title)', () => {
    const sinNombre = [];
    for (const ruta of archivos) {
      const src = readFileSync(ruta, 'utf8');
      for (const m of src.matchAll(BOTON_SOLO_GLIFO)) {
        const attrs = m[1];
        if (!/aria-label[=\s]/.test(attrs) && !/\btitle=/.test(attrs)) {
          sinNombre.push(`${ruta.split(/[\\/]/).pop()}: ${m[0].slice(0, 90)}`);
        }
      }
    }
    expect(sinNombre, `botones sólo-ícono sin nombre:\n${sinNombre.join('\n')}`).toEqual([]);
  });
});

/* Un <button> adentro de otro <button> no es HTML válido y React lo grita en
   consola en cada render. Pasó de verdad: el encabezado de cada bloque
   muscular en Hoy.jsx era un <button> y llevaba adentro los ▲▼ de reordenar.
   No es cosmético — el navegador repara el DOM moviendo nodos, React queda
   reconciliando contra otro árbol, y los lectores de pantalla no saben
   anunciar un control dentro de otro control.

   La salida cuando un contenedor entero tiene que ser tocable pero lleva
   botones adentro ya está en el repo: <div role="button"> + tabIndex +
   onKeyDown con el chequeo target===currentTarget (RestTimer.jsx, Hoy.jsx). */
function sinComentarios(src) {
  // El comentario de RestTimer.jsx EXPLICA el problema escribiendo "<button>"
  // en prosa; contarlo como markup sería un falso positivo eterno.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('botones anidados', () => {
  it('ningún <button> contiene otro <button>', () => {
    const anidados = [];
    for (const ruta of jsxDeTodoElArbol(RAIZ)) {
      const src = sinComentarios(readFileSync(ruta, 'utf8'));
      let prof = 0;
      for (const m of src.matchAll(/<button\b|<\/button>/g)) {
        if (m[0] === '</button>') { prof = Math.max(0, prof - 1); continue; }
        prof++;
        if (prof > 1) {
          const linea = src.slice(0, m.index).split('\n').length;
          anidados.push(`${ruta.split(/[\\/]/).pop()}:${linea}`);
        }
      }
    }
    expect(anidados, `<button> anidados:\n${anidados.join('\n')}`).toEqual([]);
  });
});

describe('sheets', () => {
  const dir = join(RAIZ, 'sheets');

  it('cada uno tiene un encabezado — es de donde Sheet.jsx saca el nombre del diálogo', () => {
    // Sheet.jsx le pone id="sheet-title" al primer h1/h2/h3 del sheet y
    // enlaza aria-labelledby. Un sheet sin encabezado deja el role="dialog"
    // anunciándose como "diálogo" a secas, sin decir cuál de los 27 es.
    const sinEncabezado = readdirSync(dir)
      .filter(n => n.endsWith('.jsx'))
      .filter(n => !/<h[1-3][\s>]/.test(readFileSync(join(dir, n), 'utf8')));
    expect(sinEncabezado).toEqual([]);
  });
});

/* Paso 3 del asistente: los equipos van con íconos SVG propios y no con
   emoji (auditoría, G7). Un hex metido en un ícono no sigue al acento. */
describe('íconos de equipo', () => {
  it('son 8: los 7 equipos reales más "Otro"', () => {
    expect(EQUIP_ASIST.map(e => e.id)).toEqual(['barra', 'mancuernas', 'discos', 'placas', 'polea', 'smith', 'corporal', '']);
  });
  it('cada uno es un <svg aria-hidden> en currentColor, sin colores escritos a mano', () => {
    for (const { id } of EQUIP_ASIST) {
      const svg = renderToStaticMarkup(createElement(EquipIcon, { id }));
      expect(svg.startsWith('<svg'), id).toBe(true);
      expect(svg, id).toContain('aria-hidden="true"');
      expect(svg, id).toContain('stroke="currentColor"');
      expect(svg, id).not.toMatch(/(fill|stroke)="#/);
    }
  });
  it('dibujos distintos entre sí', () => {
    const dibujos = EQUIP_ASIST.map(({ id }) => renderToStaticMarkup(createElement(EquipIcon, { id })));
    expect(new Set(dibujos).size).toBe(8);
  });
});

/* El asistente de agregar ejercicio, montado en cada paso (SSR: sin
   efectos). Lo que se mira es lo que un lector de pantalla necesita y lo
   que el arrastre de drag.js da por hecho. */
describe('asistente "Agregar ejercicio"', () => {
  const ex = (id, name) => ({ id, name, sets: 3, reps: 10 });
  const enPaso = (tipo, paso) => {
    let e = setNombre(estadoInicial(tipo), 'Remo en polea');
    for (let i = 1; i < paso; i++) e = avanzar(e).estado;
    return e;
  };
  const html = (tipo, paso) => renderToStaticMarkup(createElement(AgregarEjercicio, { wd: 0, tipo, inicial: enPaso(tipo, paso) }));

  function preparar() {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Tirón', exercises: [
      ex('a', 'Jalón al pecho'), ex('b', 'Curl con barra'), ex('c', 'Remo con barra'), ex('d', 'Face pull'),
    ] }];
    S.draft = {
      id: 'd1', date: '2026-09-27', slotId: 's1', dayName: 'Tirón', open: 1, start: 1, cur: 'b',
      order: ['a', 'b', 'c', 'd'], skipped: [], extraSets: {}, extras: [],
      entries: { a: { sets: [{}, {}, {}] } },
    };
    S.hoyVals = {};
  }

  for (const tipo of ['rutina', 'sesion']) {
    for (const paso of [1, 2, 3]) {
      it(`${tipo}, paso ${paso}: un solo h2, botones con nombre y progreso`, () => {
        preparar();
        const h = html(tipo, paso);
        expect(h.match(/<h2\b/g) || []).toHaveLength(1);
        for (const b of h.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || []) {
          const texto = b.replace(/<[^>]+>/g, '').trim();
          expect(texto || /aria-label="[^"]+"/.test(b), b.slice(0, 120)).toBeTruthy();
        }
        expect(h).toMatch(new RegExp(`role="progressbar"[^>]*aria-valuenow="${paso}"|aria-valuenow="${paso}"[^>]*role="progressbar"`));
      });
    }
  }

  it('paso 2: la fila nueva está en la caja arrastrable y ningún fijo', () => {
    preparar();
    const h = html('sesion', 2);
    const caja = h.slice(h.indexOf('data-sort="asist"'));
    expect(caja).toContain(`data-sid="${NUEVO}"`);
    // "a" ya está hecho: va arriba, fuera de la caja.
    expect(h.indexOf('Jalón al pecho')).toBeLessThan(h.indexOf('data-sort="asist"'));
    expect(caja).not.toContain('data-sid="a"');
    // Los pendientes están en la caja, marcados fijos (no se agarran).
    expect(caja).toMatch(/data-sid="b"[^>]*data-fijo=""|data-fijo=""[^>]*data-sid="b"/);
  });

  it('paso 3: la grilla de equipo es un radiogroup de 8 y unilateral un switch', () => {
    preparar();
    const h = html('rutina', 3);
    expect(h).toContain('role="radiogroup"');
    expect(h.match(/role="radio"/g)).toHaveLength(8);
    expect(h).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(h).toContain('Agregar a la rutina');
  });

  it('en la sesión el CTA dice sesión y avisa que vale sólo para hoy', () => {
    preparar();
    const h = html('sesion', 3);
    expect(h).toContain('Agregar a la sesión');
    expect(h).toContain('Vale sólo para hoy');
  });
});
