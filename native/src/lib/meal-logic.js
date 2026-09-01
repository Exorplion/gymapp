// native/src/lib/meal-logic.js
// Puerto de las dos funciones puras (sin JSX) que viven al tope de
// web/src/components/sheets/MealForm.jsx (líneas 1-42) — el resto de ese
// archivo es el sheet completo de búsqueda/carrito, fuera de alcance (queda
// para Etapa 5). logMeal/addMealFromFood son las que usan las filas "Un
// toque" y "Frecuentes" de Nutricion.jsx.
import { S, bump } from './state.js';
import { uid, vibrate } from './format.js';
import { idb } from './db.js';
import { toast } from './toast.js';
import { slotForTime } from './meals.js';

const ahora = () => new Date().toTimeString().slice(0, 5);

/** Registra algo con forma {name,kcal,p,c,f} como comida del día seleccionado.
    Lo comparten las filas "Un toque" y "Frecuentes" de Nutricion.jsx. */
export async function logMeal(f, slot) {
  const t = ahora();
  const meal = {
    id: uid(), date: S.nutriDate, name: f.name,
    kcal: f.kcal, p: f.p, c: f.c, f: f.f,
    t, slot: slot || slotForTime(t),
  };
  await idb.put('meals', meal);
  S.meals.push(meal);
  vibrate(12);
  bump();
  toast(`＋ ${f.name}`);
}

/** Puerto verbatim de addMealFromFood(id) — busca en S.foods y delega. */
export async function addMealFromFood(id) {
  const f = S.foods.find(x => x.id === id);
  if (!f) return;
  await logMeal(f);
}
