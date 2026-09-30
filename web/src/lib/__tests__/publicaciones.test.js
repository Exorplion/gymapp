// Qué archivos de assets/ se conservan al publicar (scripts/publicaciones.mjs).
//
// El caso real (2026-09-29): una pantalla abierta desde antes de una
// publicación pidió `PrBurst-BFgPSmMD.js` al cerrar la sesión, pero
// publish-root había borrado assets/ entero y el service worker nuevo ya había
// limpiado su caché → "Failed to fetch dynamically imported module" y la
// pantalla entera caída. Conservando los archivos de las últimas publicaciones,
// una pestaña vieja todavía encuentra lo que pide.
import { describe, it, expect } from 'vitest';
import { podar, CONSERVAR } from '../../../scripts/publicaciones.mjs';

describe('podar: los assets de las últimas publicaciones', () => {
  it('la primera vez, lo que ya estaba cuenta como una publicación anterior', () => {
    const { historial, borrar } = podar(null, ['index-B.js'], ['index-A.js', 'PrBurst-A.js']);
    expect(historial).toEqual([['index-A.js', 'PrBurst-A.js'], ['index-B.js']]);
    expect(borrar).toEqual([]);
  });

  it('conserva las últimas CONSERVAR publicaciones y borra las anteriores', () => {
    const viejo = Array.from({ length: CONSERVAR }, (_, i) => [`index-${i}.js`]);
    const { historial, borrar } = podar(viejo, ['index-nuevo.js'], []);
    expect(historial).toHaveLength(CONSERVAR);
    expect(historial.at(-1)).toEqual(['index-nuevo.js']);
    expect(borrar).toEqual(['index-0.js']);
  });

  it('nunca borra un archivo que sigue usando una publicación conservada', () => {
    // El Lottie no cambió de hash entre builds: aparece en la vieja y en la nueva.
    const viejo = [['index-0.js', 'lottie-X.json'], ...Array.from({ length: CONSERVAR - 1 }, (_, i) => [`index-${i + 1}.js`])];
    const { borrar } = podar(viejo, ['index-nuevo.js', 'lottie-X.json'], []);
    expect(borrar).toEqual(['index-0.js']);
  });

  it('borra también los sueltos que no figuran en ninguna publicación conservada', () => {
    const { borrar } = podar([['a.js']], ['b.js'], ['a.js', 'b.js', 'huerfano.js']);
    expect(borrar).toEqual(['huerfano.js']);
  });

  it('un historial corrupto se trata como si no existiera', () => {
    const { historial, borrar } = podar('no-es-un-array', ['b.js'], ['a.js']);
    expect(historial).toEqual([['a.js'], ['b.js']]);
    expect(borrar).toEqual([]);
  });
});
