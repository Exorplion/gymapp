// G4 (auditoría total 2026-09): cambiar de pestaña bloqueaba 0,3–0,7 s a 6×
// y ~40 % era layout forzado por dos lecturas de geometría justo después de
// montar la pantalla nueva: el getBoundingClientRect de la píldora de la
// barra (TabBar.jsx) y el scrollHeight de las dos vistas para el min-height
// de main (App.jsx). Las dos se reemplazaron por CSS (la píldora se ubica
// con el índice y cqw; las vistas comparten una celda de grilla). Este test
// es la red contra volver a medir ahí: se lee el código como texto, igual
// que a11y-markup.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const leer = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const sinComentarios = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('cambio de pestaña sin layout forzado', () => {
  it('la barra no mide botones para ubicar la píldora', () => {
    const src = sinComentarios(leer('../../components/TabBar.jsx'));
    expect(src).not.toMatch(/getBoundingClientRect|offsetWidth|offsetLeft|useLayoutEffect/);
    expect(src).toMatch(/'--i'/);
  });

  it('main no mide el alto de las vistas', () => {
    const src = sinComentarios(leer('../../App.jsx'));
    expect(src).not.toMatch(/scrollHeight/);
    expect(src).not.toMatch(/style\.minHeight/);
  });

  it('la saliente es la pantalla viva (misma key), no una copia del DOM', () => {
    const app = sinComentarios(leer('../../App.jsx'));
    const estado = sinComentarios(leer('../state.js'));
    expect(app + estado).not.toMatch(/cloneNode|sacarFoto|tomarFotoSaliente/);
    expect(app).toMatch(/key=\{vistaSaliente\.tab\}/);
    expect(app).toMatch(/key=\{store\.tab\}/);
  });

  it('el CSS apila las dos vistas en la misma celda y calcula la píldora', () => {
    const css = leer('../../styles.css');
    expect(css).toMatch(/main\s*>\s*\.view\.enter,\s*main\s*>\s*\.view\.leave\{grid-area:1\/1\}/);
    expect(css).toMatch(/nav\.tabbar\{container-type:inline-size\}/);
    const ind = css.match(/\.tab-ind\{[^}]*\}/)[0];
    expect(ind).toMatch(/var\(--i/);
    // sólo transform: el ancho es igual para las cuatro pestañas
    expect(ind).toMatch(/transition:transform [^;,]*;/);
  });
});
