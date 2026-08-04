// El índice de alimentos y su búsqueda.
//
// Une dos fuentes en una sola forma: TUS alimentos (S.foods, incluidos los que
// importaste en Markdown) y la tabla incorporada (foodtable.js). Los tuyos
// ganan siempre — la misma regla que ya aplica el dictado por voz
// (foodvoice.js). La tabla es el respaldo, nunca la autoridad.
//
// Hasta ahora esa tabla de ~55 alimentos SÓLO la usaba el dictado: el
// formulario manual te hacía escribir kcal, proteína, carbos y grasa a mano en
// cada comida.
import { S } from './state.js';
import { norm, round1 } from './format.js';
import { FOOD_TABLE } from './foodtable.js';

/** Cuántos gramos proponer por defecto: la porción natural si el alimento la
    declara, si no 100 g. */
export function defaultGrams(food) {
  return food?.unit || 100;
}

/** Macros de `grams` gramos de `food`.

    base '100g'    -> los números son por 100 g y se escalan.
    base 'portion' -> los números son de UNA porción, que pesa `unit` gramos.
      Es lo que tienen todos los S.foods viejos (guardados con "marcar como
      frecuente"), que no traen `base`. Sin `unit` la porción vale 100 g, así
      la cuenta con los 100 g por defecto es la identidad y nada cambia de
      comportamiento para quien ya venía usando la app. */
export function macrosFor(food, grams) {
  const por = food?.base === '100g' ? 100 : (food?.unit || 100);
  const k = (grams || 0) / por;
  return {
    kcal: Math.round((food?.kcal || 0) * k),
    p: round1((food?.p || 0) * k),
    c: round1((food?.c || 0) * k),
    f: round1((food?.f || 0) * k),
  };
}

/** Todos los alimentos conocidos, deduplicados por nombre normalizado. */
export function foodIndex() {
  const out = [];
  const vistos = new Set();
  (S.foods || []).forEach(f => {
    const key = norm(f.name);
    if (!key || vistos.has(key)) return;
    vistos.add(key);
    out.push({
      key, name: f.name, alias: f.alias || [],
      kcal: f.kcal, p: f.p, c: f.c, f: f.f,
      unit: f.unit ?? null, cat: f.cat ?? null,
      base: f.base || 'portion', source: 'mine', id: f.id,
    });
  });
  FOOD_TABLE.forEach(it => {
    const key = norm(it.n);
    if (!key || vistos.has(key)) return;
    vistos.add(key);
    out.push({
      key, name: it.n, alias: it.a || [],
      kcal: it.kcal, p: it.p, c: it.c, f: it.f,
      unit: it.u ?? null, cat: null,
      base: '100g', source: 'table', id: null,
    });
  });
  return out;
}

/** Cuántas veces registraste cada nombre, y cuántas en cada momento del día. */
function uso() {
  const total = new Map(), porSlot = new Map();
  (S.meals || []).forEach(m => {
    const k = norm(m.name);
    if (!k) return;
    total.set(k, (total.get(k) || 0) + 1);
    if (m.slot) porSlot.set(`${m.slot}|${k}`, (porSlot.get(`${m.slot}|${k}`) || 0) + 1);
  });
  return { total, porSlot };
}

/* Puntaje de coincidencia; más alto es mejor, 0 es "no coincide".

   El escalonado importa: con una sola regla de "contiene", buscar "pollo"
   ponía "pollo a la brasa" a la misma altura que "pollo" — el mismo error que
   foodvoice.js ya documenta para el dictado. */
function puntajeTexto(f, q) {
  let best = 0;
  for (const cand of [f.key, ...f.alias.map(norm)]) {
    if (!cand) continue;
    if (cand === q) best = Math.max(best, 100);
    else if (cand.startsWith(q)) best = Math.max(best, 70);
    else if (cand.split(/\s+/).some(w => w.startsWith(q))) best = Math.max(best, 50);
    else if (cand.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/**
 * searchFoods('po', { slot: 'almuerzo' })
 *
 * Con `query` vacía devuelve sugerencias: lo que más comés en ese momento del
 * día, después lo que más comés en general. Con query, ordena por coincidencia
 * y desempata por uso.
 */
export function searchFoods(query, { slot = null, limit = 20 } = {}) {
  const q = norm(query || '');
  const idx = foodIndex();
  const { total, porSlot } = uso();
  const usoDe = f => (slot ? (porSlot.get(`${slot}|${f.key}`) || 0) * 10 : 0) + (total.get(f.key) || 0);

  if (!q) {
    return idx
      .map(f => ({ f, u: usoDe(f) }))
      .filter(x => x.u > 0)
      .sort((a, b) => b.u - a.u || a.f.name.localeCompare(b.f.name))
      .slice(0, limit)
      .map(x => x.f);
  }

  return idx
    .map(f => ({ f, s: puntajeTexto(f, q), u: usoDe(f) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || b.u - a.u || a.f.name.length - b.f.name.length || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map(x => x.f);
}
