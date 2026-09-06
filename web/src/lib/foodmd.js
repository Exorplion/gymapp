// La tabla de alimentos, de ida y vuelta a Markdown.
//
// Exportar sin poder importar no lleva a ningún lado, así que las dos mitades
// nacen juntas y comparten el mismo formato: la salida de foodsToMD() la lee
// parseFoodsMD() sin perder nada.
//
// Todo por 100 g. "Unidad" es cuánto pesa una porción natural (1 huevo, 1
// scoop) y es opcional. Las reglas van escritas en el encabezado del propio
// archivo para poder editarlo en cualquier editor sin tener que consultar nada.
import { S } from './state.js';
import { idb } from './db.js';
import { dstr, uid, norm } from './format.js';
import { FOOD_TABLE } from './foodtable.js';
import { toast } from './toast.js';

const COLS = ['Alimento', 'Alias', 'kcal', 'P', 'C', 'G', 'Unidad', 'Categoría'];

const ENCABEZADO = `# Alimentos · FIERRO

Macros **por 100 g**. "Unidad" es cuánto pesa una porción natural
(1 huevo, 1 scoop) y es opcional. Los alias van separados por coma.

Podés editar, agregar o borrar filas y volver a importar el archivo desde
Ajustes. Al importar, tus alimentos ganan sobre la tabla incorporada y no se
borra nada: se actualizan los que ya estaban y se agregan los nuevos.
`;

/** Número de celda: acepta coma decimal y celda vacía. */
function celdaNum(cell) {
  const t = String(cell ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function celdaTexto(cell) {
  const t = String(cell ?? '').trim();
  return t || null;
}

/** Serializa una lista de alimentos (forma por 100 g) a la tabla markdown. */
export function foodsToMD(list) {
  const filas = (list || []).map(f => [
    f.name,
    (f.alias || []).join(', '),
    f.kcal ?? '',
    f.p ?? '',
    f.c ?? '',
    f.f ?? '',
    f.unit ?? '',
    f.cat ?? '',
  ]);
  const lineas = [
    `| ${COLS.join(' | ')} |`,
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...filas.map(r => `| ${r.join(' | ')} |`),
  ];
  return `${ENCABEZADO}\n${lineas.join('\n')}\n`;
}

/** Lee la tabla markdown. Ignora todo lo que no sea una fila de datos: el
    encabezado en prosa, la fila de guiones, la de títulos y cualquier línea
    suelta. Una fila sin nombre o sin calorías se descarta — mejor perder una
    fila rota que inventarle macros. */
export function parseFoodsMD(md) {
  const out = [];
  for (const linea of String(md || '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t.startsWith('|')) continue;
    const celdas = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    if (celdas.length < 6) continue;
    if (celdas.every(c => /^:?-{2,}:?$/.test(c) || !c)) continue;   // fila de separadores
    const name = celdaTexto(celdas[0]);
    const kcal = celdaNum(celdas[2]);
    if (!name || kcal === null) continue;
    if (norm(name) === 'alimento') continue;                        // la fila de títulos
    out.push({
      name,
      alias: (celdas[1] || '').split(',').map(a => a.trim()).filter(Boolean),
      kcal,
      /* `null`, no 0: una macro que la tabla no declara es un DATO QUE FALTA,
         no una medición de cero. Guardarla como 0 la convertía en un hecho
         inventado —"este alimento no tiene proteína"— que después sumaba a la
         meta diaria como si alguien lo hubiera medido. Contradecía además el
         comentario de este mismo archivo unas líneas más arriba ("mejor
         perder una fila rota que inventarle macros") y el criterio de
         CLAUDE.md.
         No cambia ningún total hoy: macrosFor() (foodsearch.js) ya hace
         `|| 0` al escalar. Lo que cambia es que el dato queda honesto en
         disco, así que la UI puede distinguir "0 g" de "sin dato" cuando se
         decida cómo mostrarlo. */
      p: celdaNum(celdas[3]),
      c: celdaNum(celdas[4]),
      f: celdaNum(celdas[5]),
      unit: celdaNum(celdas[6]),
      cat: celdaTexto(celdas[7]),
    });
  }
  return out;
}

/** Todo lo que la app conoce, en forma "por 100 g": los alimentos tuyos que ya
    están en esa base, más la tabla incorporada para los que no. */
function todoParaExportar() {
  const mios = S.foods.filter(f => f.base === '100g').map(f => ({
    name: f.name, alias: f.alias || [], kcal: f.kcal, p: f.p, c: f.c, f: f.f,
    unit: f.unit ?? null, cat: f.cat ?? null,
  }));
  const tomados = new Set(mios.map(f => norm(f.name)));
  const tabla = FOOD_TABLE
    .filter(it => !tomados.has(norm(it.n)))
    .map(it => ({ name: it.n, alias: it.a || [], kcal: it.kcal, p: it.p, c: it.c, f: it.f, unit: it.u ?? null, cat: null }));
  return [...mios, ...tabla];
}

export function exportFoodsMD() {
  const blob = new Blob([foodsToMD(todoParaExportar())], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fierro-alimentos-${dstr()}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Alimentos exportados');
}

/** Merge por nombre normalizado: actualiza los que ya tenías y agrega los
    nuevos. No borra nada — un archivo recortado no te vacía la base. */
export async function importFoodsMD(file) {
  let filas;
  try {
    filas = parseFoodsMD(await file.text());
  } catch {
    toast('⚠ No se pudo leer el archivo');
    return;
  }
  if (!filas.length) { toast('⚠ No encontré ninguna fila de alimentos'); return; }

  const porNombre = new Map(S.foods.map(f => [norm(f.name), f]));
  let nuevos = 0, actualizados = 0;
  for (const r of filas) {
    const existente = porNombre.get(norm(r.name));
    const food = {
      id: existente ? existente.id : uid(),
      name: r.name, alias: r.alias, kcal: r.kcal, p: r.p, c: r.c, f: r.f,
      unit: r.unit, cat: r.cat, base: '100g',
    };
    await idb.put('foods', food);
    if (existente) { Object.assign(existente, food); actualizados++; }
    else { S.foods.push(food); porNombre.set(norm(food.name), food); nuevos++; }
  }
  toast(`${nuevos} alimento${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'} · ${actualizados} actualizado${actualizados === 1 ? '' : 's'}`);
}
