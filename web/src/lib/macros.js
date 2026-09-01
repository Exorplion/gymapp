// Motor de macros — puerto verbatim de index.html. Nada hardcodeado: todo se
// deriva del perfil real del usuario (S.cfg.profile / S.body).
import { S, saveCfg } from './state.js';
import { KG2LB, dstr } from './format.js';
import { mealsOf } from './meals.js';

export const ACTF = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
export const ACT_LABEL = { sedentary: 'Sedentario', light: 'Ligero', moderate: 'Moderado', high: 'Alto' };
export const ACT_HINT = { sedentary: 'oficina, poco movimiento', light: '1-3 entrenos/sem', moderate: '3-5 entrenos/sem', high: '6+ entrenos o trabajo físico' };
export const GOALDELTA = { deficit_mod: -300, deficit_agg: -500, maintenance: 0, surplus: 250, recomp: -250 };
export const GOAL_LABEL = { deficit_mod: 'Déficit moderado', deficit_agg: 'Déficit agresivo', maintenance: 'Mantenimiento', surplus: 'Superávit', recomp: 'Recomposición' };
export const GOAL_HINT = { deficit_mod: '−300 kcal · ~0.25-0.3 kg/sem', deficit_agg: '−500 kcal · ~0.5 kg/sem', maintenance: 'mantener peso', surplus: '+250 kcal · ganar músculo', recomp: '−250 kcal · proteína alta' };

export function profileWeight() {
  const p = S.cfg.profile;
  if (p && p.weightKg) return p.weightKg;
  const b = S.body.filter(x => x.weight != null);
  return b.length ? b[b.length - 1].weight : null;
}

export function computeMacros() {
  const p = S.cfg.profile;
  const w = profileWeight();
  if (!p || !w || !p.age || !p.height) return null;
  const bmr = Math.round(10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5));
  const tdeeCalc = Math.round(bmr * (ACTF[p.activity] || 1.55));
  const empirical = p.tdeeEmpirical && p.tdeeEmpirical > 0 ? p.tdeeEmpirical : null;
  const tdee = empirical || tdeeCalc;
  const target = Math.max(0, Math.round(tdee + (GOALDELTA[p.goal] || 0)));
  const lb = w * KG2LB;
  const protMin = Math.round(lb * 0.8), protMax = Math.round(lb * 1.0);
  const fatMin = Math.round(lb * 0.3), fatMax = Math.round(lb * 0.5);
  const prot = Math.round(protMin + (protMax - protMin) * (p.proteinPref ?? 0.5));
  const fat = Math.round(fatMin + (fatMax - fatMin) * (p.fatPref ?? 0.5));
  const carbs = Math.max(0, Math.round((target - prot * 4 - fat * 9) / 4));
  return {
    weight: w, bmr, tdeeCalc, empirical, tdee, target,
    protMin, protMax, protMid: Math.round((protMin + protMax) / 2), prot,
    fatMin, fatMax, fatMid: Math.round((fatMin + fatMax) / 2), fat, carbs,
  };
}

/** Si el perfil está completo y las metas son automáticas, deriva goals. */
export function applyComputedGoals() {
  if (!S.cfg.goalsAuto) return false;
  const m = computeMacros();
  if (!m) return false;
  S.cfg.goals = { kcal: m.target, p: m.prot, c: m.carbs, f: m.fat };
  return true;
}

/* ---------- ajuste semanal por bandas (Plan Fierro · Fase 2) ----------
   MVP del TDEE adaptativo: reglas discretas en vez de una regresión sobre
   peso×calorías. Compara el cambio de peso semanal real contra el ritmo
   esperado por el objetivo (GOALDELTA/7700 kcal por kg) y sugiere ±100kcal
   si el ritmo real se aleja del esperado — "en rango" no toca nada. */
const KCAL_PER_KG = 7700;

/** Kg/semana esperados según el objetivo actual (negativo = bajar de peso). */
export function expectedWeeklyRate() {
  const p = S.cfg.profile;
  const delta = GOALDELTA[p?.goal] ?? 0;
  return (delta * 7) / KCAL_PER_KG;
}

/** Compara el cambio real de peso (últimos `weeks` × 7 días, por defecto 2)
    contra el ritmo esperado del objetivo, y sugiere un ajuste de calorías
    por bandas. null si no hay suficiente historial de peso todavía —
    hacen falta al menos dos registros separados por varios días para que
    "ritmo semanal" signifique algo. */
export function weeklyBandAdjustment(weeks = 2) {
  const ws = S.body.filter(b => b.weight != null);
  if (ws.length < 2) return null;
  const days = weeks * 7;
  const end = ws[ws.length - 1];
  const cutoff = +new Date(end.date + 'T12:00:00') - days * 86400000;
  const start = ws.find(b => +new Date(b.date + 'T12:00:00') >= cutoff);
  if (!start || start === end) return null;
  const spanDays = (+new Date(end.date + 'T12:00:00') - +new Date(start.date + 'T12:00:00')) / 86400000;
  if (spanDays < 5) return null; // ventana demasiado corta para que un ritmo semanal signifique algo
  const actualWeekly = ((end.weight - start.weight) / spanDays) * 7;
  const expected = expectedWeeklyRate();
  // Zona muerta de ±0.1 kg/sem: el peso fluctúa por agua/glucógeno, así que
  // sin margen el ajuste oscilaría de un día para el otro sin que cambiara nada real.
  const diff = actualWeekly - expected;
  let adjust = 0;
  if (diff > 0.1) adjust = -100;       // bajando más lento (o subiendo más) de lo esperado → recortar
  else if (diff < -0.1) adjust = 100;  // bajando más rápido (o subiendo menos) de lo esperado → sumar
  return { actualWeekly: Math.round(actualWeekly * 100) / 100, expected: Math.round(expected * 100) / 100, adjust };
}

/* ---------- TDEE adaptativo continuo (Plan Fierro · Fase 3) ----------
   El algoritmo de referencia (MacroFactor): en vez de ADIVINAR el gasto con
   una fórmula (Mifflin-St Jeor, siempre igual sea cual sea tu metabolismo
   real), lo DESPEJA al revés desde el resultado real —
   TDEE = intake_promedio − (Δpeso × 7700kcal/kg) — usando lo que la app YA
   tiene registrado en ambos lados: S.body y S.meals. */

/** Kcal promedio realmente registradas entre `fromDate` y `toDate`
    (inclusive), sólo contando los días que SÍ tienen al menos una comida —
    un día sin registrar no cuenta como "cero calorías", cuenta como "sin
    dato", así que no distorsiona el promedio hacia abajo. */
function avgIntake(fromDate, toDate) {
  let day = new Date(fromDate + 'T12:00:00');
  const end = new Date(toDate + 'T12:00:00');
  let total = 0, days = 0;
  while (day <= end) {
    const ds = dstr(day);
    const meals = mealsOf(ds);
    if (meals.length) { total += meals.reduce((a, m) => a + m.kcal, 0); days++; }
    day.setDate(day.getDate() + 1);
  }
  return days ? { avg: total / days, days } : null;
}

/** Recalcula el TDEE empírico comparando el peso promedio de la semana
    ACTUAL contra la semana ANTERIOR (weeklyAvg() ya hace esa comparación en
    charts.js — acá se reimplementa sólo lo del peso para no crear una
    dependencia circular macros.js↔charts.js) contra las calorías realmente
    registradas en esa misma ventana de 7 días.

    Devuelve null si falta cualquiera de los dos lados: sin al menos 2
    semanas de peso Y comidas registradas en la ventana reciente, no hay con
    qué despejar nada — mejor no calcular que inventar un número. */
export function computeAdaptiveTDEE() {
  const ws = S.body.filter(b => b.weight != null);
  if (ws.length < 2) return null;
  const end = new Date(ws[ws.length - 1].date + 'T12:00:00');
  const daysAgo = d => (end - new Date(d + 'T12:00:00')) / 86400000;
  const cur = ws.filter(b => { const g = daysAgo(b.date); return g >= 0 && g < 7; });
  const prev = ws.filter(b => { const g = daysAgo(b.date); return g >= 7 && g < 14; });
  if (!cur.length || !prev.length) return null;
  const avg = a => a.reduce((s, b) => s + b.weight, 0) / a.length;
  const deltaKg = avg(cur) - avg(prev);

  const toDate = ws[ws.length - 1].date;
  const fromDate = dstr(new Date(+end - 6 * 86400000));
  const intake = avgIntake(fromDate, toDate);
  // Menos de 4 días con comidas registradas en la semana: el promedio de
  // intake no es confiable todavía (un solo día atípico pesaría demasiado).
  if (!intake || intake.days < 4) return null;

  const tdee = Math.round(intake.avg - (deltaKg * KCAL_PER_KG) / 7);
  return { tdee, deltaKg: Math.round(deltaKg * 100) / 100, intakeAvg: Math.round(intake.avg), daysWithData: intake.days };
}

/** Corre computeAdaptiveTDEE() y, si da un resultado, lo guarda en
    S.cfg.profile.tdeeEmpirical — el campo que ya existía en el schema pero
    nunca se auto-calculaba (Plan Fierro, "la oportunidad más grande de todo
    el análisis"). Se llama una vez por semana desde loadAll() (state.js),
    no en cada render: recorrer S.sessions/S.meals no es gratis y el número
    no cambia sesión a sesión. */
export async function refreshAdaptiveTDEE() {
  const today = dstr();
  if (S.cfg.tdeeCheckedDate === today) return false; // ya se corrió hoy
  const r = computeAdaptiveTDEE();
  S.cfg.tdeeCheckedDate = today;
  if (r) {
    S.cfg.profile.tdeeEmpirical = r.tdee;
    applyComputedGoals();
  }
  await saveCfg();
  return !!r;
}
