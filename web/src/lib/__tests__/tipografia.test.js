// La tipografía como sistema cerrado (tanda B de la auditoría visual 2).
//
// El relevamiento midió 14 firmas de rótulo versal, 23 trackings, 12 tamaños
// (dos de ellos fugas: el 16 del navegador y el 12 de Tailwind) y un peso
// 800 pedido en el CSS que nunca se cargó. Nada de eso fallaba: se veía un
// poco peor en cada pantalla. Estos tests lo vuelven un error.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const web = join(src, '..');
const css = readFileSync(join(src, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Reglas del CSS fuera de los bloques de tokens (@theme y :root).
function reglas() {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (/^(@theme|:root)/.test(sel) || sel.startsWith('@font-face')) continue;
    out.push({ sel, body: m[2] });
  }
  return out;
}

function archivos(dir, ext) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : archivos(p, ext);
    return ext.test(n) ? [p] : [];
  });
}

describe('fuentes', () => {
  const caras = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map(m => {
    const b = m[1];
    const fam = /font-family:'([^']+)'/.exec(b)[1];
    const w = /font-weight:(\d+)/.exec(b)[1];
    const st = /font-style:(\w+)/.exec(b)[1];
    const url = /url\('\.\/([^']+)'\)/.exec(b)[1];
    return { cara: `${fam} ${w} ${st}`, url };
  });

  it('carga exactamente las seis caras que usa la app, desde archivos propios', () => {
    expect(caras.map(c => c.cara).sort()).toEqual([
      'Barlow 400 normal', 'Barlow 600 normal', 'Barlow 700 normal',
      'Barlow Condensed 700 normal', 'Barlow Condensed 800 italic', 'Barlow Condensed 800 normal',
    ]);
    for (const c of caras) expect(existsSync(join(src, c.url)), c.url).toBe(true);
  });

  it('no depende de Google Fonts y el service worker precarga las woff2', () => {
    expect(readFileSync(join(web, 'index.html'), 'utf8')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(readFileSync(join(web, 'vite.config.js'), 'utf8')).toMatch(/globPatterns:\s*\[[^\]]*woff2/);
  });
});

describe('escala', () => {
  it('el body tiene tamaño: nada cae al 16 del navegador', () => {
    expect(css).toMatch(/body\{[^}]*font-size:var\(--t-body\)/);
  });

  it('ningún font-size fuera de la escala (sólo tokens o em relativos)', () => {
    const malos = reglas().flatMap(r => [...r.body.matchAll(/font-size:\s*([^;]+)/g)]
      .map(m => m[1].trim()).filter(v => !/^var\(--t-[a-z0-9]+\)$/.test(v) && v !== 'inherit')
      .map(v => `${r.sel.slice(-50)}: ${v}`));
    expect(malos).toEqual([]);
  });

  it('no queda el paso de 10 px (G12)', () => {
    expect(css).not.toMatch(/--t-nano|--text-nano/);
  });

  it('sólo pesos cargados, y la itálica sólo en 800', () => {
    const pesos = new Set(reglas().flatMap(r => [...r.body.matchAll(/font-weight:\s*([^;]+)/g)].map(m => m[1].trim())));
    for (const p of pesos) expect(['400', '600', '700', '800']).toContain(p);
    const italicas = reglas().filter(r => /font-style:\s*italic/.test(r.body));
    for (const r of italicas) expect(r.body, r.sel).toMatch(/font-weight:\s*800/);
  });

  it('todo letter-spacing sale de un rol', () => {
    const malos = reglas().flatMap(r => [...r.body.matchAll(/letter-spacing:\s*([^;]+)/g)]
      .map(m => m[1].trim()).filter(v => !/^var\(--tr-[a-z]+\)$/.test(v) && v !== '0')
      .map(v => `${r.sel.slice(-50)}: ${v}`));
    expect(malos).toEqual([]);
  });
});

describe('JSX', () => {
  const jsx = archivos(join(src, 'components'), /\.jsx$/).concat([join(src, 'App.jsx')]);
  it('sin utilidades fuera de la escala ni tamaños en línea', () => {
    const malos = [];
    for (const f of jsx) {
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/\b(font-medium|font-black|tracking-wide|tracking-\[|text-nano|text-xs|text-base|text-3xl)\b/.test(l)
          || /fontSize:\s*\d/.test(l)) malos.push(`${f.slice(src.length)}:${i + 1}`);
      });
    }
    expect(malos).toEqual([]);
  });
});
