// Micronutrientes clave (Plan Fierro · Fase 3).
//
// Ocho, no las 95 de Cronometer: los que de verdad mueven la aguja para
// alguien que entrena en serio y que además son los que más comúnmente
// quedan bajos. El criterio de diseño es el del plan — aviso SÓLO si
// estuvieron bajos 5 de los últimos 7 días, nunca ruido diario:
//
//   · un día bajo en magnesio no significa nada
//   · cinco de siete es un patrón, y eso sí vale contarlo
//
// Honestidad sobre los datos: FOOD_TABLE sólo tiene `mn` en los alimentos
// donde el aporte es relevante (ver foodtable.js). Un alimento sin `mn` NO
// cuenta como cero — cuenta como "sin dato", y por eso `coverage` viaja
// junto al total: sin decir cuánto de lo que comiste se pudo medir, un
// "hierro bajo" podría ser en realidad "no sé qué comiste".
import { S } from './state.js';
import { dstr, norm } from './format.js';
import { FOOD_TABLE } from './foodtable.js';

/** Los ocho, con su RDA de referencia para un adulto que entrena y la
    unidad en que se expresa. Valores de referencia general (no son consejo
    médico y la app no los presenta como tal). */
export const MICROS = [
  { k: 'fe', label: 'Hierro', unit: 'mg', rda: 8 },
  { k: 'mg', label: 'Magnesio', unit: 'mg', rda: 400 },
  { k: 'vitd', label: 'Vitamina D', unit: 'mcg', rda: 15 },
  { k: 'k', label: 'Potasio', unit: 'mg', rda: 3400 },
  { k: 'zn', label: 'Zinc', unit: 'mg', rda: 11 },
  { k: 'ca', label: 'Calcio', unit: 'mg', rda: 1000 },
  { k: 'omega3', label: 'Omega-3', unit: 'g', rda: 1.6 },
  { k: 'b12', label: 'B12', unit: 'mcg', rda: 2.4 },
];

/* Índice nombre-normalizado -> entrada de la tabla, incluyendo alias. Se
   arma una vez al cargar el módulo: FOOD_TABLE es estática. */
const BY_NAME = new Map();
for (const it of FOOD_TABLE) {
  BY_NAME.set(norm(it.n), it);
  for (const alias of it.a || []) BY_NAME.set(norm(alias), it);
}

/** La entrada de tabla que corresponde a un nombre de comida registrado, o
    null. Busca exacto y después por inclusión (el nombre registrado puede
    traer adornos: "pollo a la plancha con ensalada"). */
function tableEntry(name) {
  const n = norm(name);
  if (!n) return null;
  const exact = BY_NAME.get(n);
  if (exact) return exact;
  // La coincidencia más LARGA gana, por el mismo motivo que catOf()
  // (muscle.js): "arroz integral" tiene que ganarle a "arroz".
  let best = null, bestLen = 0;
  for (const [key, it] of BY_NAME) {
    if (key.length > bestLen && n.includes(key)) { best = it; bestLen = key.length; }
  }
  return best;
}

/** Micronutrientes totales de un día, más qué proporción de las calorías de
    ese día vinieron de alimentos que SÍ tienen datos (`coverage`, 0-1).

    Los gramos por comida sólo se conocen cuando la comida se registró con
    `items` (el registro por voz los guarda — ver foodvoice.js). Sin
    gramos, se estima desde las kcal registradas contra las kcal/100g de la
    tabla: es una aproximación, pero es la misma que ya hace toda la app al
    tratar una comida dictada como un total. */
export function microsOfDay(date) {
  const meals = S.meals.filter(m => m.date === date);
  const total = Object.fromEntries(MICROS.map(m => [m.k, 0]));
  let kcalConDatos = 0, kcalTotal = 0;

  for (const meal of meals) {
    kcalTotal += meal.kcal || 0;
    // Comida registrada por voz con desglose: cada item por separado, que
    // es el caso preciso.
    const items = meal.items?.length ? meal.items : [{ name: meal.name, grams: null, kcal: meal.kcal }];
    for (const it of items) {
      const entry = tableEntry(it.name);
      if (!entry?.mn) continue;
      const grams = it.grams != null
        ? it.grams
        : (entry.kcal ? ((it.kcal || 0) / entry.kcal) * 100 : 0);
      if (!grams) continue;
      kcalConDatos += it.kcal || 0;
      for (const m of MICROS) {
        const per100 = entry.mn[m.k];
        if (per100 != null) total[m.k] += (per100 * grams) / 100;
      }
    }
  }

  return {
    total: Object.fromEntries(MICROS.map(m => [m.k, Math.round(total[m.k] * 100) / 100])),
    coverage: kcalTotal ? Math.min(1, kcalConDatos / kcalTotal) : 0,
    hasMeals: meals.length > 0,
  };
}

/** Los micronutrientes que estuvieron por debajo del 70% de su RDA en 5 o
    más de los últimos 7 días. Devuelve [] si no hay suficientes días con
    comidas registradas (menos de 5) — sin datos no se avisa nada, que es
    distinto de "estás bien".

    El umbral es 70% y no 100% a propósito: la RDA ya lleva margen de
    seguridad, y avisar por quedarse en el 95% sería exactamente el ruido
    diario que el plan pide evitar. */
export function lowMicros() {
  const cuenta = Object.fromEntries(MICROS.map(m => [m.k, 0]));
  let diasConDatos = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const { total, coverage, hasMeals } = microsOfDay(dstr(d));
    // Un día con cobertura pobre (< 50% de las kcal medibles) no puede
    // sostener la afirmación "te faltó X": se saltea en vez de contarlo
    // como déficit.
    if (!hasMeals || coverage < 0.5) continue;
    diasConDatos++;
    for (const m of MICROS) {
      if (total[m.k] < m.rda * 0.7) cuenta[m.k]++;
    }
  }

  if (diasConDatos < 5) return [];
  return MICROS
    .filter(m => cuenta[m.k] >= 5)
    .map(m => ({ ...m, dias: cuenta[m.k] }));
}
