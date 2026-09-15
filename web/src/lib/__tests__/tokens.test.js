// Guardia contra un error que no avisa: usar var(--algo) con un token que no
// existe.
//
// Es el caso que de verdad pasó, así que es el test. En Progreso las bandas
// de volumen estaban escritas como `var(--text-mut, #8B97B4)` y
// `var(--danger, #FF5470)`. Ninguno de esos dos tokens existió nunca — los
// nombres reales son --mut y --red. CSS no falla ante un var() con un nombre
// inexistente: usa el fallback y sigue. Así que durante meses dos de las
// cuatro bandas se pintaron con hex de la paleta anterior al rediseño
// "acero", sin seguir el tema ni el color elegido en Ajustes, y nadie lo vio
// porque la pantalla se veía "bien" — sólo que con los colores de antes.
//
// Del mismo espíritu que a11y-markup.test.js: se lee el código como texto,
// porque la pregunta ("¿este nombre está definido?") se responde mirando, no
// montando la app.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function archivosDe(dir, exts) {
  const out = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '__tests__') continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...archivosDe(ruta, exts));
    else if (exts.some(e => nombre.endsWith(e))) out.push(ruta);
  }
  return out;
}

/* Los comentarios se sacan antes de buscar. Este archivo y styles.css están
   llenos de prosa que EXPLICA el problema —"estaba escrito como
   var(--token, #hex)"— y un test que marca su propia explicación como error
   es un test que la gente aprende a ignorar. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')   // /* bloque */ — CSS y JS
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // // línea — el guard evita comerse https://
}

/* Variables que NO son tokens de diseño: se setean por elemento desde el JSX
   (style={{'--fill': ...}}) o las pone Tailwind. Buscarlas en :root sería
   buscar algo que por definición no está ahí. */
const POR_ELEMENTO = new Set([
  '--fill', '--i', '--n', '--lift', '--drift', '--rot',
  '--sil-dy', '--sil-esc', '--sil-org',
  '--tw-leading',
]);

describe('tokens de CSS', () => {
  const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
  const definidos = new Set([...css.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map(m => m[1]));

  it('styles.css define una cantidad razonable de tokens (si esto falla, la ruta se rompió)', () => {
    expect(definidos.size).toBeGreaterThan(80);
  });

  it('ningún var() apunta a un token que no existe', () => {
    const huerfanos = new Map();
    const archivos = [join(SRC, 'styles.css'), ...archivosDe(join(SRC, 'components'), ['.jsx']), ...archivosDe(join(SRC, 'lib'), ['.js', '.ts'])];

    for (const ruta of archivos) {
      const texto = sinComentarios(readFileSync(ruta, 'utf8'));
      for (const m of texto.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)) {
        const t = m[1];
        if (definidos.has(t) || POR_ELEMENTO.has(t)) continue;
        // La línea entera, para que el mensaje del fallo se pueda accionar
        // sin tener que ir a buscar dónde estaba.
        const linea = texto.slice(0, m.index).split('\n').length;
        huerfanos.set(`${t}  ←  ${ruta.split(/[\\/]/).pop()}:${linea}`, true);
      }
    }

    expect(
      [...huerfanos.keys()],
      'Estos var() nombran tokens que no existen. CSS no avisa: usa el fallback (o queda vacío) y la app se ve "bien" con el color equivocado. Definí el token en styles.css o corregí el nombre.',
    ).toEqual([]);
  });

  /* El bug más caro de la auditoría del 2026-09-15, y el más silencioso.

     styles.css tenía `*{margin:0;padding:0}`, `button{background:none;
     border:none}` e `input,select,button,textarea{color:inherit}` escritos
     SIN capa, después de `@import "tailwindcss"`. Tailwind v4 pone sus
     utilidades en `@layer utilities`, y en la cascada lo que no está en
     ninguna capa le gana siempre a lo que sí lo está — da igual la
     especificidad y el orden.

     Resultado: 263 utilidades de espaciado repartidas en 21 archivos .jsx no
     hacían nada, y el borde y el fondo de los botones estilados con Tailwind
     tampoco. Nadie lo iba a encontrar leyendo un componente: los componentes
     estaban bien escritos, sus clases no llegaban.

     Este test vigila la regla general: un selector de ELEMENTO que pise una
     propiedad que Tailwind también genera tiene que vivir dentro de una capa. */
  it('ningún reset de elemento pisa las utilidades de Tailwind desde fuera de una capa', () => {
    const PISAN = /(^|;|\{)\s*(margin|padding|background|border|color|gap|display)[-:]/;
    // Selectores de elemento puro (sin punto, sin #, sin corchetes).
    const SOLO_ELEMENTOS = /^[*a-z]+(\s*,\s*[*a-z:]+)*$/;

    /* Los comentarios se sacan ANTES de parsear. Sin esto el test no sirve:
       el reset vive justo debajo de un comentario largo, y como un selector
       no puede contener "/" el regex de reglas no llegaba a verlo. Se
       comprobó: con el bug reintroducido, el test pasaba igual. */
    const limpio = sinComentarios(css);

    // Se recorta todo lo que está dentro de un @layer{...} para quedarse con
    // lo suelto. Conteo de llaves, porque las reglas anidan.
    let sinCapa = '';
    let i = 0;
    while (i < limpio.length) {
      const prox = limpio.indexOf('@layer', i);
      if (prox === -1) { sinCapa += limpio.slice(i); break; }
      sinCapa += limpio.slice(i, prox);
      const abre = limpio.indexOf('{', prox);
      if (abre === -1) break;
      let nivel = 1, j = abre + 1;
      while (j < limpio.length && nivel > 0) {
        if (limpio[j] === '{') nivel++;
        else if (limpio[j] === '}') nivel--;
        j++;
      }
      i = j;
    }

    /* Se parte por "}" en vez de usar un regex de regla completa. Con el
       regex, dos reglas seguidas no se podían detectar las dos: la primera
       consumía la llave de cierre que la segunda necesitaba como prefijo, y
       justo el reset venía pegado a otra regla. También se comprobó. */
    const culpables = [];
    for (const trozo of sinCapa.split('}')) {
      const k = trozo.indexOf('{');
      if (k === -1) continue;
      const sel = trozo.slice(0, k).trim().split('\n').pop().trim();
      const cuerpo = trozo.slice(k + 1);
      if (!sel || !SOLO_ELEMENTOS.test(sel)) continue;
      if (!PISAN.test(cuerpo)) continue;
      culpables.push(`${sel} { ${cuerpo.replace(/\s+/g, ' ').trim().slice(0, 55)}… }`);
    }

    expect(
      culpables,
      'Estas reglas están fuera de toda capa y le ganan a TODAS las utilidades de Tailwind (padding, margin, background, border…), sin importar la especificidad. Metelas en @layer base.',
    ).toEqual([]);
  });

  it('no quedan hex sueltos del color de la racha: para eso está --flame', () => {
    // #FFC46B vivía a mano en seis lugares. El token existe justamente para
    // que no vuelvan a aparecer copias.
    const archivos = [join(SRC, 'styles.css'), ...archivosDe(join(SRC, 'components'), ['.jsx'])];
    const culpables = archivos.filter(ruta => {
      // La definición del token es el único lugar donde el hex es correcto.
      const texto = sinComentarios(readFileSync(ruta, 'utf8')).replace(/--color-flame:\s*#FFC46B;/i, '');
      return /#FFC46B/i.test(texto);
    });
    expect(culpables.map(r => r.split(/[\\/]/).pop())).toEqual([]);
  });
});
