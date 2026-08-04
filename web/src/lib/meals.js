// Puerto de funciones de nutrición desde index.html
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

/** Clase de color de barra según rango (verde/ámbar/rojo) */
export function macroCls(v, kind, m) {
  if (!m) return '';
  if (kind === 'prot') { if (v >= m.protMin) return 'ok'; if (v >= m.protMin * 0.75) return 'warn'; return ''; }
  if (kind === 'fat') { if (v > m.fatMax * 1.1) return 'red'; if (v > m.fatMax) return 'warn'; if (v >= m.fatMin) return 'ok'; return ''; }
  return '';
}

/** Feedback honesto del día */
export function nutriFeedback(kc, tp, tf, g, m) {
  if (kc === 0) return `<div class="feedback"><span class="fdot"></span><div class="ftx txt-mut">Registra tu primera comida del día.</div></div>`;
  const rem = g.kcal - kc; let dot = 'blue', tx = '';
  if (rem > 150) {
    const pg = Math.max(0, g.p - tp);
    tx = `Te quedan <b>${rem} kcal</b>` + (pg > 0 ? ` y <b>${pg}g de proteína</b>` : '') + `. ${pg > 0 ? 'Prioriza proteína en lo que resta.' : 'Buen margen: llena con carbos o grasa a gusto.'}`;
  } else if (rem >= -150) { dot = 'ok'; tx = `En el objetivo del día 👌 <span class="txt-mut">(±150 kcal está perfecto — importa el promedio semanal).</span>`; }
  else { dot = 'red'; tx = `Te pasaste <b>${-rem} kcal</b>. No pasa nada: compensa con comidas más ligeras el resto de la semana, lo que cuenta es el promedio.`; }
  if (m && tf > m.fatMax * 1.1) { dot = dot === 'ok' ? 'warn' : dot; tx += ` <span class="txt-warn">Grasa alta: ${tf}g (máx ${m.fatMax}g).</span>`; }
  else if (m && tp < m.protMin && rem <= 150) { tx += ` <span class="txt-warn">Proteína baja: ${tp}g (mín ${m.protMin}g).</span>`; }
  return `<div class="feedback ${dot}"><span class="fdot"></span><div class="ftx">${tx}</div></div>`;
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
