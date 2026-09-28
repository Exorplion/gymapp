// El vidrio tiene que sobrevivir al build (auditoría 2026-09-27, G1).
//
// Las reglas estaban escritas `backdrop-filter:X;-webkit-backdrop-filter:X`.
// El minificador las toma como la misma propiedad dos veces, se queda con la
// última —la prefijada— y borra la otra. Chrome/Android no lee el prefijo:
// `getComputedStyle(header).backdropFilter` daba 'none' en el header, la
// barra de pestañas, las hojas, el descanso y cada .card, también en el
// sitio publicado. En el dev server se veía bien, por eso nadie lo notó.
//
// Por eso el test no lee styles.css: construye el CSS con el mismo Vite y el
// mismo plugin de Tailwind que `npm run build`, y mira lo que sale.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const WEB = new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/* Las declaraciones de cada regla del CSS minificado: `selector{decls}`. Los
   @media/@supports dejan su propio `{`, pero como sólo se miran las
   declaraciones del bloque más interno, alcanza con partir por llaves. */
function reglas(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) out.push({ sel: m[1].trim(), decl: m[2] });
  return out;
}
const tiene = (decl, prop) => new RegExp(`(^|;)\\s*${prop}\\s*:`).test(decl);

let css = '';
beforeAll(async () => {
  const salida = await build({
    configFile: false,
    root: WEB,
    logLevel: 'silent',
    plugins: [tailwindcss()],
    build: { write: false, emptyOutDir: false, rollupOptions: { input: `${WEB}/index.html` } },
  });
  const res = Array.isArray(salida) ? salida : [salida];
  css = res.flatMap(r => r.output).filter(a => a.fileName.endsWith('.css')).map(a => a.source).join('\n');
}, 60000);

describe('backdrop-filter en el CSS de producción', () => {
  it('el build produce CSS', () => {
    expect(css.length).toBeGreaterThan(10000);
  });

  it('ninguna regla queda sólo con el prefijo -webkit-', () => {
    const rotas = reglas(css)
      .filter(r => tiene(r.decl, '-webkit-backdrop-filter') && !tiene(r.decl, 'backdrop-filter'))
      .map(r => r.sel);
    expect(rotas).toEqual([]);
  });

  it('el header, la barra, las hojas, el descanso y las tarjetas tienen vidrio', () => {
    const conVidrio = new Set(reglas(css).filter(r => tiene(r.decl, 'backdrop-filter')).map(r => r.sel));
    for (const sel of ['header.top', 'nav.tabbar', '#rest-fs', '#sheet .panel', '.card']) {
      expect(conVidrio, sel).toContain(sel);
    }
  });

  it('en la fuente se escribe sin prefijo (el build lo agrega solo)', () => {
    // Si alguien vuelve a escribir el par a mano, el minificador vuelve a
    // borrar el bueno. Se lee la fuente sin comentarios.
    for (const f of ['src/styles.css', 'src/styles-coverflow.css']) {
      const fuente = readFileSync(`${WEB}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(fuente.match(/-webkit-backdrop-filter/g) || [], f).toEqual([]);
    }
  });
});
