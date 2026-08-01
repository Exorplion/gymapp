// Interpreta lo que dictás sobre lo que comiste y lo convierte en macros.
//
// Sin internet, sin API, sin costo: primero busca en TUS alimentos guardados
// (los que ya registraste alguna vez), y sólo si no encuentra nada cae a la
// tabla de alimentos comunes. Tus alimentos siempre ganan — si vos anotaste
// que tu avena tiene otros macros, esos se usan.
//
// Lo que no reconoce no se inventa: vuelve marcado como desconocido para que
// lo completes una vez, y a partir de ahí queda guardado como tuyo.
import { FOOD_TABLE, UNITS, NUM_WORDS } from './foodtable.js';
import { norm, round1 } from './format.js';

/** Separa el dictado en trozos: "200 g de pollo y dos huevos" → 2 trozos. */
function splitParts(text) {
  return String(text || '')
    // "con" NO separa: es parte de muchos nombres de plato ("arroz con
    // pollo"). Si el plato completo no existe, parseFoodSpeech lo parte después.
    .replace(/\by\b|\bmas\b|\bmás\b|\btambien\b|\btambién\b/gi, ',')
    .split(/[,;.]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/** Cantidad al inicio del trozo: "200", "dos", "medio", "1.5". */
function readQty(words) {
  const w = words[0];
  if (!w) return { qty: null, rest: words };
  const asNum = parseFloat(w.replace(',', '.'));
  if (!Number.isNaN(asNum) && /^[\d.,]+$/.test(w)) return { qty: asNum, rest: words.slice(1) };
  const key = norm(w);
  if (key in NUM_WORDS) return { qty: NUM_WORDS[key], rest: words.slice(1) };
  return { qty: null, rest: words };
}

/** Unidad de medida tras la cantidad: "gramos", "taza", "plato"… */
function readUnit(words) {
  const w = norm(words[0] || '');
  for (const u of UNITS) {
    if (u.k.some(k => norm(k) === w)) {
      // se come el "de" de "200 gramos DE pollo"
      const rest = norm(words[1] || '') === 'de' ? words.slice(2) : words.slice(1);
      return { unit: u, rest };
    }
  }
  return { unit: null, rest: words };
}

/** Busca el alimento por nombre o alias, primero en los tuyos y luego en la tabla. */
function findFood(phrase, userFoods) {
  const q = norm(phrase);
  if (!q) return null;

  // 1) Tus alimentos. Coincidencia exacta antes que parcial, para que "pollo"
  //    no se lleve por delante a "pollo con arroz" si tenés ambos.
  const mine = (userFoods || []).map(f => ({ f, k: norm(f.name) }));
  const mineExact = mine.find(x => x.k === q);
  if (mineExact) return { source: 'mine', food: mineExact.f, exact: true };
  const minePart = mine.find(x => x.k && (q.includes(x.k) || x.k.includes(q)));
  if (minePart) return { source: 'mine', food: minePart.f, exact: false };

  // 2) Tabla común, en tres pasadas de precisión decreciente. El orden
  //    importa: con una sola regla de "coincidencia más larga", dictar
  //    "arroz" terminaba registrando "arroz con pollo" — el nombre del plato
  //    contiene la palabra, así que ganaba por longitud. Registrar un plato
  //    entero cuando dijiste un ingrediente es un error caro y silencioso.
  let exact = null, contained = null, containing = null;
  for (const it of FOOD_TABLE) {
    for (const cand of [it.n, ...(it.a || [])]) {
      const k = norm(cand);
      if (!k) continue;
      if (q === k) { exact = exact || { it, len: k.length }; continue; }
      // a) lo que dictaste contiene al alimento ("un plato de arroz con pollo"
      //    contiene "arroz con pollo"): gana el más largo, el más específico.
      if (q.includes(k) && (!contained || k.length > contained.len)) contained = { it, len: k.length };
      // b) el alimento contiene lo que dictaste ("arroz" está dentro de "arroz
      //    integral"): gana el más CORTO, el más cercano a lo que dijiste.
      else if (k.includes(q) && (!containing || k.length < containing.len)) containing = { it, len: k.length };
    }
  }
  const best = exact || contained || containing;
  return best ? { source: 'table', food: best.it, exact: !!exact } : null;
}

/** Escala los macros de un alimento de tabla (por 100 g) a los gramos dados. */
function fromTable(it, grams) {
  const k = grams / 100;
  return {
    kcal: Math.round(it.kcal * k),
    p: round1(it.p * k),
    c: round1(it.c * k),
    f: round1(it.f * k),
  };
}

/**
 * parseFoodSpeech("200 gramos de pollo y dos huevos", S.foods)
 *
 * Devuelve un item por trozo reconocido:
 *   { name, grams, kcal, p, c, f, source: 'mine'|'table', text }
 * y para lo que no reconoce:
 *   { name, unknown: true, text }
 *
 * Nunca inventa macros para un alimento que no conoce.
 */
export function parseFoodSpeech(text, userFoods) {
  const out = [];
  for (const part of splitParts(text)) {
    const words = part.split(/\s+/).filter(Boolean);
    const { qty, rest: afterQty } = readQty(words);
    const { unit, rest: afterUnit } = readUnit(afterQty);
    // "de" suelto tras la cantidad: "medio de palta"
    const nameWords = norm(afterUnit[0] || '') === 'de' ? afterUnit.slice(1) : afterUnit;
    const phrase = nameWords.join(' ').trim();
    if (!phrase) continue;

    let hit = findFood(phrase, userFoods);

    // "pollo con arroz" no es un plato de la tabla, pero "arroz con pollo" sí.
    // Se prueba primero la frase entera; si no hay un plato con ese nombre
    // exacto, recién ahí se parte en ingredientes.
    //
    // Se parte el texto ORIGINAL, no la frase ya despojada de cantidad: cada
    // lado del "con" trae la suya ("200 g de pollo con 100 g de arroz"), y
    // reinyectar la primera cantidad en ambos lados multiplicaba los gramos.
    if ((!hit || !hit.exact) && / con /.test(` ${part} `)) {
      const pieces = part.split(/\s+con\s+/).filter(Boolean);
      if (pieces.length > 1) {
        const sub = pieces.flatMap(piece => parseFoodSpeech(piece, userFoods));
        if (sub.some(i => !i.unknown)) { out.push(...sub); continue; }
      }
    }

    if (!hit) { out.push({ name: phrase, unknown: true, text: part }); continue; }

    const n = qty == null ? 1 : qty;

    if (hit.source === 'mine') {
      // Tus alimentos ya están guardados por porción, así que la cantidad
      // multiplica la porción entera.
      const f = hit.food;
      out.push({
        name: f.name, source: 'mine', text: part, qty: n,
        kcal: Math.round((f.kcal || 0) * n),
        p: round1((f.p || 0) * n), c: round1((f.c || 0) * n), f: round1((f.f || 0) * n),
      });
      continue;
    }

    const it = hit.food;
    // Gramos: por unidad de medida si la dijiste, si no por unidad natural
    // del alimento ("dos huevos" = 2 × 55 g).
    const perUnit = unit ? (unit.g == null ? (it.u || 100) : unit.g) : (it.u || 100);
    const grams = Math.round(n * perUnit);
    out.push({
      name: it.n, source: 'table', text: part, qty: n, grams,
      ...fromTable(it, grams),
    });
  }
  return out;
}

/** Suma de un listado, para mostrar el total antes de confirmar. */
export function sumItems(items) {
  return (items || []).filter(i => !i.unknown).reduce((a, i) => ({
    kcal: a.kcal + (i.kcal || 0),
    p: round1(a.p + (i.p || 0)),
    c: round1(a.c + (i.c || 0)),
    f: round1(a.f + (i.f || 0)),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
}
