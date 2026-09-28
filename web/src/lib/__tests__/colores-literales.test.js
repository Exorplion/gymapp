// Ningún color escrito a mano en styles.css fuera del bloque de tokens.
//
// Es la causa de fondo de "todo es azul" (relevamiento del 2026-09-27): el
// acento elegido en Ajustes cambiaba 17 variables, y quedaban 68 azules
// literales, la base navy del vidrio en ~22 reglas, la arista celeste y el
// resplandor de fondo. Un literal no es una custom property: theme.js no
// puede pisarlo, y nadie se entera porque la pantalla se ve "bien" con el
// color de antes.
//
// La regla es simple: los valores viven en el bloque de tokens (el `@theme
// inline` y el primer `:root` de styles.css); todo lo demás los nombra.
// Hasta el blanco de un brillo: rgba(var(--hi-rgb),α).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(import.meta.dirname, '../../styles.css'), 'utf8');

/* Los comentarios se vacían pero conservan los saltos de línea, para que el
   número de línea del mensaje sea el del archivo. */
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

/* El bloque de tokens termina donde cierra el primer :root. */
const inicioRoot = sinComentarios.indexOf(':root{');
const finTokens = sinComentarios.indexOf('\n}', inicioRoot) + 2;

const LITERAL = new RegExp([
  '#[0-9a-fA-F]{3,8}\\b',               // hex
  '\\brgba?\\(\\s*\\d',                 // rgb(12,…) — rgba(var(--x-rgb),α) no cuenta
  '\\bhsla?\\(',
  '\\b(?:ok)?l(?:ch|ab)\\(',            // oklch(), lch(), oklab(), lab()
  '\\bcolor\\((?!-mix)',                // color(display-p3 …)
  // colores con nombre como valor (no dentro de un selector ni un nombre de clase)
  '(?<=[:\\s,(])(?:white|black|red|blue|green|navy|cyan|gray|grey|orange|yellow|purple|pink)(?=[\\s,;)!]|$)',
].join('|'), 'gi');

describe('colores literales en styles.css', () => {
  it('el bloque de tokens se encuentra (si esto falla, cambió la estructura del archivo)', () => {
    expect(inicioRoot).toBeGreaterThan(0);
    expect(finTokens).toBeGreaterThan(inicioRoot);
  });

  it('fuera del bloque de tokens no hay ningún color escrito a mano', () => {
    const lineaInicio = sinComentarios.slice(0, finTokens).split('\n').length;
    const culpables = [];
    sinComentarios.slice(finTokens).split('\n').forEach((linea, i) => {
      // Sólo valores: lo que está después de un ":" de declaración. Así un
      // selector como `.chip.blue` o `.pbar>i.red` no cuenta.
      const decls = linea.split(';').map(d => (d.includes(':') ? d.slice(d.indexOf(':') + 1) : ''));
      for (const valor of decls) {
        const m = valor.match(LITERAL);
        if (m) culpables.push(`styles.css:${lineaInicio + i}  ${m.join(' ')}  ←  ${linea.trim().slice(0, 90)}`);
      }
    });
    expect(
      culpables,
      'Color literal fuera del bloque de tokens: usá un token de :root (o creá uno ahí). Un literal no sigue al acento elegido.',
    ).toEqual([]);
  });

  it('el vidrio no satura más de 1.2 (a más, amplifica el tinte de lo que tiene detrás)', () => {
    const saturates = [...sinComentarios.matchAll(/saturate\(\s*([\d.]+)\s*\)/g)].map(m => Number(m[1]));
    expect(saturates.length).toBeGreaterThan(0);
    for (const s of saturates) expect(s).toBeLessThanOrEqual(1.2);
  });
});
