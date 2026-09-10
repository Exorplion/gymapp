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
