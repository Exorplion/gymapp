// Motor de macros — puerto verbatim de index.html. Nada hardcodeado: todo se
// deriva del perfil real del usuario (S.cfg.profile / S.body).
import { S } from './state.js';
import { KG2LB } from './format.js';

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
