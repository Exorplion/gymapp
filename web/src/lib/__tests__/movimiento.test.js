// El movimiento como sistema cerrado (tanda E de la auditoría visual 2 y
// tanda 5 de la auditoría total: G5, G6, G10).
//
// Lo que estos tests vuelven un error se encontró midiendo, no leyendo: un
// brillo que animaba `left` en loop en todas las pantallas (G5), siete
// `transition` sin propiedad que animaban TODO lo que cambiara (G6), dientes
// de la rueda animando font-size, barras animando width, y 17 duraciones
// sueltas entre CSS y JS (G10). Nada de eso falla solo: se ve un poco peor,
// o cuesta un layout por cuadro, y nadie lo nota hasta que se mide.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cssCrudo = readFileSync(join(src, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// El bloque de "reducir movimiento" global usa .01ms a propósito: es la
// forma de apagar todo sin romper animationend.
const css = cssCrudo.replace(/@media\s*\(prefers-reduced-motion:reduce\)\s*\{\s*\*,\*::before,\*::after\{[^}]*\}\s*\}/, '');

/** Declaraciones `prop: valor` fuera de :root y @theme (ahí viven los tokens). */
function declaraciones(prop) {
  const sinTokens = css.replace(/(?::root|@theme)\s*\{[^}]*\}/g, '');
  const re = new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'g');
  return [...sinTokens.matchAll(re)].map(m => m[1].trim());
}

/** Las propiedades que mueven el layout: animarlas recalcula la página en
    cada cuadro. grid-template-rows es la excepción aceptada (el pliegue 0fr →
    1fr, que no necesita medir). */
const LAYOUT = /^(width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|inset|margin(-\w+)?|padding(-\w+)?|font-size|font-weight|letter-spacing|line-height|border-width|gap)$/;

describe('movimiento: transiciones', () => {
  const trans = declaraciones('transition');

  it('hay transiciones que revisar (si esto falla, el parser se rompió)', () => {
    expect(trans.length).toBeGreaterThan(40);
  });

  it('toda transition nombra sus propiedades: nunca `all` ni una duración sola (G6)', () => {
    const malas = [];
    for (const t of trans) {
      if (t === 'none') continue;
      for (const tramo of t.split(/,(?![^(]*\))/)) {
        const primera = tramo.trim().split(/\s+/)[0];
        if (primera === 'all' || /^(var\(--d|calc\(|[\d.]+m?s$)/.test(primera)) malas.push(t);
      }
    }
    expect(malas).toEqual([]);
  });

  it('ninguna transition anima una propiedad de layout', () => {
    const malas = [];
    for (const t of trans) {
      for (const tramo of t.split(/,(?![^(]*\))/)) {
        const prop = tramo.trim().split(/\s+/)[0];
        if (LAYOUT.test(prop)) malas.push(t);
      }
    }
    expect(malas).toEqual([]);
  });
});

describe('movimiento: keyframes', () => {
  const bloques = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)];

  it('hay keyframes que revisar', () => {
    expect(bloques.length).toBeGreaterThan(20);
  });

  it('ningún @keyframes anima una propiedad de layout (G5: el brillo animaba left)', () => {
    const malos = [];
    for (const [, nombre, cuerpo] of bloques) {
      for (const [, props] of cuerpo.matchAll(/\{([^}]*)\}/g)) {
        for (const decl of props.split(';')) {
          const prop = decl.split(':')[0].trim();
          if (prop && LAYOUT.test(prop)) malos.push(`${nombre}: ${prop}`);
        }
      }
    }
    expect(malos).toEqual([]);
  });

  it('no hay dos @keyframes con el mismo nombre (el segundo pisa al primero sin avisar)', () => {
    const nombres = bloques.map(b => b[1]);
    expect(nombres.filter((n, i) => nombres.indexOf(n) !== i)).toEqual([]);
  });
});

describe('movimiento: duraciones (G10)', () => {
  const props = ['transition', 'transition-duration', 'transition-delay', 'animation', 'animation-duration', 'animation-delay'];

  it('ninguna duración suelta en CSS: salen de --d1..--d4, --d-paso o un --ciclo-*', () => {
    const malas = [];
    for (const p of props) {
      for (const v of declaraciones(p)) {
        // 0s es "sin retardo", no una duración elegida.
        const sueltas = v.replace(/\b0s\b/g, '').match(/(?<![\w-])[\d.]+m?s\b/g);
        if (sueltas) malas.push(`${p}: ${v}`);
      }
    }
    expect(malas).toEqual([]);
  });

  it('ninguna curva escrita a mano en una animación o transición: los tokens --ease*/--spring', () => {
    const malas = [];
    for (const p of props) for (const v of declaraciones(p)) if (/cubic-bezier\(/.test(v)) malas.push(`${p}: ${v}`);
    expect(malas).toEqual([]);
  });

  function archivos(dir) {
    const out = [];
    for (const n of readdirSync(dir)) {
      if (n === '__tests__' || n === 'node_modules') continue;
      const r = join(dir, n);
      if (statSync(r).isDirectory()) out.push(...archivos(r));
      else if (/\.(jsx?|tsx?)$/.test(n)) out.push(r);
    }
    return out;
  }
  const js = [...archivos(join(src, 'components')), ...archivos(join(src, 'lib')), join(src, 'App.jsx')]
    .map(r => [r.split(/[\\/]/).pop(), readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')]);

  it('ningún estilo inline con una duración en segundos o ms (animation / transition)', () => {
    const malos = [];
    for (const [n, t] of js) {
      for (const m of t.matchAll(/(animation|transition)[A-Za-z]*\s*[:=]\s*['"`][^'"`]*?(?<![\w-])[\d.]+m?s\b/g)) malos.push(`${n}: ${m[0]}`);
    }
    expect(malos).toEqual([]);
  });

  it('los helpers de movimiento reciben tiempos de D, no números sueltos', () => {
    const malos = [];
    const re = /(staggerReveal|sheetReveal|screenReveal|countTo|popIn|animateRing|detailsSlide)\([^;]*?\b(duration|delay|delayStep)\s*:\s*\d/g;
    for (const [n, t] of js) for (const m of t.matchAll(re)) malos.push(`${n}: ${m[0]}`);
    expect(malos).toEqual([]);
  });
});

describe('movimiento: vocabulario (tanda E)', () => {
  it('el brillo que barre es opt-in (.brilla), no de todo .btn primario (G5)', () => {
    expect(css).not.toMatch(/\.btn:not\(\.sm\)[^{]*::after\s*\{[^}]*sweep/);
    expect(css).toMatch(/\.btn\.brilla::after\s*\{[^}]*animation:sweep/);
  });

  it('un solo anillo que late: SEGUIR y el paso activo de la rampa usan @keyframes anillo', () => {
    expect(css).not.toMatch(/@keyframes (ctaAnillo|rampaAnillo|rampaLate)\b/);
    expect(css).toMatch(/\.ini-cta-seguir::before,\.ini-cta-seguir::after,\s*\.ex-paso\.cur i::before,\.ex-paso\.cur i::after\{[^}]*animation:anillo var\(--ciclo-activo\)/);
  });

  it('los loops de la pantalla de atrás se pausan con una hoja o el descanso encima', () => {
    expect(css).toMatch(/:root:has\(#sheet\.open, #rest-fs\.show\)[^{]*\{animation-play-state:paused\}/);
  });

  it('entrar y salir tienen su vocabulario: @keyframes entra / sale', () => {
    expect(css).toMatch(/@keyframes entra\{from\{opacity:0;transform:translateY\(var\(--entra-y\)\)\}\}/);
    expect(css).toMatch(/@keyframes sale\{to\{opacity:0;transform:translateY\(var\(--sale-y\)\)\}\}/);
  });
});
