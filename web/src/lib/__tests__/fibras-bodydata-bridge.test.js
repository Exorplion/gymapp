import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esGrupo } from '../fibras.js';
import { CUERPOS } from '../bodydata.js';

// El puente entre fibras.js y bodydata.js es una coincidencia EXACTA de
// string: fibrasDe() devuelve nombres de porción ('Clavicular', 'Costal',
// etc.) y BodyMini.jsx los busca como `sub` de una zona en bodydata.js (o,
// si esGrupo() dice que es un grupo entero, pinta el grupo). Si alguien
// cambia una letra de un lado y no del otro, la porción deja de encenderse
// EN SILENCIO — sin error, sin warning, el usuario sólo ve que no se pinta.
//
// fibras.js no exporta su tabla interna (TABLA), y a propósito no la
// tocamos para no acoplar más el módulo sólo para testear. En cambio,
// leemos el archivo fuente como texto y extraemos con regex todos los
// nombres de porción que aparecen en `p: [...]` y `s: [...]`. Es la forma
// de enumerar "todo lo que fibrasDe() puede devolver" sin duplicar la
// tabla a mano (que se desincroniza tan fácil como el bug que este test
// busca prevenir).
const fibrasSrcPath = fileURLToPath(new URL('../fibras.js', import.meta.url));
const fibrasSrc = readFileSync(fibrasSrcPath, 'utf8');

function extraerPorciones(src) {
  const nombres = new Set();
  // Matchea p: [ 'A', 'B' ] o s: [ 'A' ], con comillas simples o dobles.
  const bloqueRe = /[ps]:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = bloqueRe.exec(src))) {
    const strRe = /['"]([^'"]+)['"]/g;
    let s;
    while ((s = strRe.exec(m[1]))) nombres.add(s[1]);
  }
  return nombres;
}

// Todos los nombres de subzona que la lámina sabe pintar, de ambos cuerpos.
const SUBS = new Set();
for (const sexo of ['m', 'f']) for (const cara of ['frente', 'espalda']) {
  CUERPOS[sexo][cara].zonas.forEach(z => z.sub && SUBS.add(z.sub));
}

describe('puente fibras.js <-> bodydata.js', () => {
  const porciones = extraerPorciones(fibrasSrc);

  it('extrajo al menos las porciones esperadas (sanity check del regex)', () => {
    expect(porciones.has('Dorsal bajo')).toBe(true);
    expect(porciones.has('Clavicular')).toBe(true);
    expect(porciones.size).toBeGreaterThan(10);
  });

  it('toda porción que fibrasDe() puede devolver existe como sub en bodydata.js o es un grupo entero', () => {
    const huerfanas = [...porciones].filter(nombre => !SUBS.has(nombre) && !esGrupo(nombre));
    expect(huerfanas, `Porciones sin zona en bodydata.js y sin ser grupo: ${huerfanas.join(', ')}`).toEqual([]);
  });
});
