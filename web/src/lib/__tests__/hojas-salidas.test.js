// Tanda 2 de la auditoría total ("Hojas y salidas", G2 · H4 · B3) y los
// nombres accesibles de la tanda 7 (G17 · E3).
//
// Las animaciones se leen como texto: la pregunta ("¿la hoja sale del marco
// o se queda a 155 px?", "¿el cierre dura lo mismo que el timer que la
// desmonta?") se contesta mirando el CSS y las constantes, no montando la
// app. Lo que se ve cuadro a cuadro se midió en Chrome (ver HANDOFF.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { D } from '../motion.js';
import { CIERRE_MS } from '../../components/Sheet.jsx';
import { SALIDA_MS as SALIDA_FIN } from '../../components/SessionComplete.jsx';
import { SALIDA_FICHA } from '../../components/Silhouette.jsx';

const SRC = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const css = readFileSync(join(SRC, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de la primera regla cuyo selector es exactamente `sel`. */
function regla(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm'));
  return m ? m[1] : null;
}
function keyframes(nombre) {
  const m = css.match(new RegExp(`@keyframes\\s+${nombre}\\s*\\{([\\s\\S]*?\\})\\s*\\}`));
  return m ? m[1] : null;
}
const TOKEN_MS = { '--d1': D.toque, '--d2': D.objeto, '--d3': D.panel, '--d4': D.momento };
/** Duraciones (en ms) de todas las animaciones de una declaración `animation:`. */
function duraciones(decl) {
  return [...decl.matchAll(/var\((--d[1-4])\)/g)].map(m => TOKEN_MS[m[1]]);
}

describe('G2 · hojas: entran y salen completas', () => {
  it('shup arranca fuera del marco (100 %), no con el 40 % ya en pantalla', () => {
    expect(keyframes('shup')).toMatch(/translateY\(100%\)/);
  });
  it('la entrada tiene fundido', () => {
    const panel = regla('#sheet .panel');
    expect(panel).toMatch(/animation:[^;]*shup[^;]*,[^;]*fdin/);
  });
  it('shdown termina fuera del marco y transparente: nada queda quieto a medio camino', () => {
    const k = keyframes('shdown');
    expect(k).toMatch(/translateY\(100%\)/);
    expect(k).toMatch(/opacity:\s*0/);
  });
  it('la salida es más corta que la entrada y no usa ease-out (que llega y se queda quieta)', () => {
    const entrada = Math.max(...duraciones(regla('#sheet .panel').match(/animation:([^;]*)/)[1]));
    const salida = regla('#sheet.closing .panel').match(/animation:([^;]*)/)[1];
    expect(Math.max(...duraciones(salida))).toBeLessThan(entrada);
    expect(salida).not.toMatch(/--ease-out/);
  });
  it('CIERRE_MS sale de D y cubre la salida más larga de las tres variantes', () => {
    expect(Object.values(D)).toContain(CIERRE_MS);
    for (const sel of ['#sheet.closing .panel', '#sheet.closing .bk', '#sheet.dialogo.closing .panel', '#sheet.pantalla.closing .panel']) {
      const r = regla(sel);
      expect(r, sel).not.toBeNull();
      for (const ms of duraciones(r.match(/animation:([^;]*)/)[1])) expect(ms, sel).toBeLessThanOrEqual(CIERRE_MS);
    }
  });
});

describe('H4 · fin de sesión con entrada y salida', () => {
  it('#session-complete entra con fundido', () => {
    expect(regla('#session-complete')).toMatch(/animation:[^;]*fdin/);
  });
  it('sale con fundido, sin tapar los toques mientras se va', () => {
    const r = regla('#session-complete.saliendo');
    expect(r).toMatch(/animation:[^;]*fdout[^;]*forwards/);
    expect(r).toMatch(/pointer-events:\s*none/);
  });
  it('la salida espera a que el fondo de la hoja llegue: arranca después de --d1 y dura SALIDA_MS', () => {
    const r = regla('#session-complete.saliendo');
    const [dur, espera] = duraciones(r.match(/animation:([^;]*)/)[1]);
    expect(espera).toBe(D.toque);
    expect(SALIDA_FIN).toBe(dur + espera);
  });
});

describe('B3 · ficha de músculo con salida', () => {
  it('.mpop.out anima hacia abajo con fundido y termina (forwards)', () => {
    expect(regla('.mpop.out')).toMatch(/animation:[^;]*mpop-out[^;]*forwards/);
    expect(keyframes('mpop-out')).toMatch(/opacity:\s*0/);
  });
  it('SALIDA_FICHA es la duración de mpop-out, que es más corta que mpop-in', () => {
    const salida = duraciones(regla('.mpop.out').match(/animation:([^;]*)/)[1]);
    const entrada = duraciones(regla('.mpop').match(/animation:([^;]*)/)[1]);
    expect(SALIDA_FICHA).toBe(Math.max(...salida));
    expect(SALIDA_FICHA).toBeLessThan(Math.max(...entrada));
  });
  it('MusclePop no le suma un bloomOpen a la animación CSS (una WAAPI le gana y la anula)', () => {
    const src = readFileSync(join(SRC, 'components', 'MusclePop.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/bloomOpen\(/);
  });
});

describe('G17 · E3 · nombres accesibles del editor de rutina', () => {
  const src = readFileSync(join(SRC, 'components', 'screens', 'Rutina.jsx'), 'utf8');
  for (const act of ['ex-up', 'ex-down', 'ex-info']) {
    it(`${act} tiene aria-label con el nombre del ejercicio`, () => {
      const m = src.match(new RegExp(`<button\\b[^>]*data-act="${act}"[\\s\\S]*?>`));
      expect(m, act).not.toBeNull();
      expect(m[0]).toMatch(/aria-label=\{`[^`]*\$\{ex\.name\}`\}/);
    });
  }
  it('el "i" sin ficha no se apaga con opacity en línea sin decirlo', () => {
    expect(src).not.toMatch(/opacity:\s*\.4\s*\}/);
  });
});

describe('C2 · agregar comida', () => {
  it('sin nada en la comida, "Agregar" está apagado y la búsqueda no lleva emoji', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: MealForm } = await import('../../components/sheets/MealForm.jsx');
    const h = renderToStaticMarkup(createElement(MealForm, {}));
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Agregar<\/button>/);
    expect(h).toContain('placeholder="Buscá un alimento"');
    expect(h).not.toMatch(/placeholder="[^"]*\p{Extended_Pictographic}/u);
  });
});
