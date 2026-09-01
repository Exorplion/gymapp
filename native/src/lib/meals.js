// Puerto de web/src/lib/meals.js — funciones de nutrición.
//
// `mealsOf`, `SLOTS`, `slotForTime`, `slotOf`, `mealsBySlot` y
// `frequentMeals` son puerto verbatim.
//
// `macroCls` y `nutriFeedback` en el original devuelven strings de HTML/clase
// CSS (`<div class="feedback ok">...</div>`, `'ok'|'warn'|'red'|''`), sin
// sentido en RN. Acá devuelven datos planos que un componente RN renderiza
// con Text/View + StyleSheet — ver el shape exacto documentado en cada
// función.
import { S } from './state.js';
import { norm } from './format.js';

export function mealsOf(date) { return S.meals.filter(m => m.date === date).sort((a, b) => a.t < b.t ? -1 : 1); }

/** Los cuatro momentos, en el orden en que se comen. */
export const SLOTS = [
  { k: 'desayuno', label: 'Desayuno' },
  { k: 'almuerzo', label: 'Almuerzo' },
  { k: 'cena', label: 'Cena' },
  { k: 'snack', label: 'Snack' },
];

/** Momento del día para una hora "HH:MM". Los cortes son los de una comida
    peruana normal, no los de un libro: se almuerza tarde y se cena tarde. */
export function slotForTime(t) {
  const h = parseInt(String(t || '').slice(0, 2), 10);
  if (Number.isNaN(h)) return 'snack';
  if (h < 11) return 'desayuno';
  if (h < 16) return 'almuerzo';
  if (h < 21) return 'cena';
  return 'snack';
}

/** El momento de una comida: el que quedó guardado, o el que se deduce de su
    hora. Las comidas viejas no tienen `slot` y NO se migran — inferir al leer
    es reversible, reescribir el historial no. */
export function slotOf(meal) {
  return meal?.slot || slotForTime(meal?.t);
}

/** El día partido en bloques, con el subtotal de kcal de cada uno. Sólo
    devuelve los bloques que tienen algo. */
export function mealsBySlot(date) {
  const del = mealsOf(date);
  return SLOTS
    .map(s => {
      const meals = del.filter(m => slotOf(m) === s.k);
      return { k: s.k, label: s.label, meals, kcal: Math.round(meals.reduce((a, m) => a + (m.kcal || 0), 0)) };
    })
    .filter(b => b.meals.length);
}

/** Tag semántico según rango del macro (no una clase CSS — el componente RN
    lo mapea a color: 'ok' -> verde, 'warn' -> ámbar, 'red' -> rojo, '' ->
    sin color / neutro).

    Mismos umbrales que el original: prot >= protMin -> 'ok', >= 75% de
    protMin -> 'warn', si no ''. fat > fatMax*1.1 -> 'red', > fatMax ->
    'warn', >= fatMin -> 'ok', si no ''. */
export function macroCls(v, kind, m) {
  if (!m) return '';
  if (kind === 'prot') { if (v >= m.protMin) return 'ok'; if (v >= m.protMin * 0.75) return 'warn'; return ''; }
  if (kind === 'fat') { if (v > m.fatMax * 1.1) return 'red'; if (v > m.fatMax) return 'warn'; if (v >= m.fatMin) return 'ok'; return ''; }
  return '';
}

/** Feedback honesto del día, como datos planos.

    Shape devuelto:
      { dot: 'empty'|'blue'|'ok'|'warn'|'red', text: string, warn: string|null }

    - dot: color del indicador. 'empty' sólo en el caso "sin comidas
      registradas todavía" (equivalente al <span class="fdot"> sin clase de
      color del original). El resto son los mismos cuatro estados que el
      original: 'blue' (sobra margen), 'ok' (en objetivo), 'red' (pasado),
      y cualquiera de esos puede subir a 'warn' si además hay una alerta de
      grasa alta (nunca por proteína baja — igual que el original).
    - text: el mensaje principal, en texto plano (sin negritas/spans HTML,
      mismo contenido y mismos números que el original).
    - warn: mensaje de alerta adicional (grasa alta o proteína baja), o null
      si no aplica. En el original iba concatenado al texto principal con un
      <span class="txt-warn">; acá se separa para que el componente lo
      resalte con su propio estilo.

    Mismos umbrales exactos que el original: margen de ±150 kcal para
    "en objetivo", grasa alta a partir de fatMax * 1.1, proteína baja por
    debajo de protMin (sólo se marca si rem <= 150, igual que el original). */
export function nutriFeedback(kc, tp, tf, g, m) {
  if (kc === 0) return { dot: 'empty', text: 'Registra tu primera comida del día.', warn: null };
  const rem = g.kcal - kc;
  let dot = 'blue', text = '';
  if (rem > 150) {
    const pg = Math.max(0, g.p - tp);
    text = `Te quedan ${rem} kcal` + (pg > 0 ? ` y ${pg}g de proteína` : '') + `. ` +
      (pg > 0 ? 'Prioriza proteína en lo que resta.' : 'Buen margen: llena con carbos o grasa a gusto.');
  } else if (rem >= -150) {
    dot = 'ok';
    text = 'En el objetivo del día 👌 (±150 kcal está perfecto — importa el promedio semanal).';
  } else {
    dot = 'red';
    text = `Te pasaste ${-rem} kcal. No pasa nada: compensa con comidas más ligeras el resto de la semana, lo que cuenta es el promedio.`;
  }
  let warn = null;
  if (m && tf > m.fatMax * 1.1) {
    dot = dot === 'ok' ? 'warn' : dot;
    warn = `Grasa alta: ${tf}g (máx ${m.fatMax}g).`;
  } else if (m && tp < m.protMin && rem <= 150) {
    warn = `Proteína baja: ${tp}g (mín ${m.protMin}g).`;
  }
  return { dot, text, warn };
}

/** Agrupa S.meals por nombre normalizado; usa los macros del registro más
    reciente de cada nombre, ordena por frecuencia */
export function frequentMeals(limit = 6) {
  const groups = new Map();
  S.meals.forEach(m => {
    const key = norm(m.name);
    if (!key) return;
    const last = m.date + ' ' + (m.t || '');
    const g = groups.get(key);
    if (!g) { groups.set(key, { name: m.name, kcal: m.kcal, p: m.p, c: m.c, f: m.f, count: 1, last }); return; }
    g.count++;
    if (last > g.last) { g.name = m.name; g.kcal = m.kcal; g.p = m.p; g.c = m.c; g.f = m.f; g.last = last; }
  });
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
