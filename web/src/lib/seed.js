// Puerto verbatim del bloque "/* ================= AJUSTES / respaldo ================= */"
// de index.html correspondiente a la carga del registro real de Enzo: datos
// estáticos (SEED_SPLIT/SEED_MEALS/SEED_BODY/MEAL_POOL) + generadores
// (genBodyForWindow/genMealsForDay/seedSessions) + las tres funciones que
// consume Settings.jsx (seedRegistro/seedCount/wipeSeed). Sólo se exportan
// esas tres — el resto (KG, SEED_*, genBodyForWindow, MEAL_POOL,
// genMealsForDay, seedSessions) queda privado al módulo, tal como en el
// original sólo el dispatcher ACT (seed-load/seed-wipe, que sí terminan en
// Settings.jsx) las necesitaba desde afuera.
//
// Import unidireccional: sólo depende de state.js/format.js/db.js/
// rutina-logic.js (persistDay/routineSnapshot/saveLib) — ninguno de esos
// importa de vuelta seed.js, así que no hay ciclo con state.js.
import { S } from './state.js';
import { dstr, uid } from './format.js';
import { idb } from './db.js';
import { persistDay, routineSnapshot, saveLib } from './rutina-logic.js';
import { saveCfg } from './state.js';

/* Datos reales del registro consolidado (13-19 jul 2026):
   · la rutina Anterior/Posterior con sus sets y RIR
   · los pesos anotados en la ronda de 6 reps (~2 semanas antes del 25/07)
   · las calorías de la semana de nutrición, día por día
   El historial de ~5 semanas de sesiones NO es un registro: está reconstruido
   hacia atrás desde esos pesos aplicando la doble progresión (5→9 reps y recién
   ahí sube el peso). Sirve para ver la app con historial, no como dato médico. */
const KG = n => Math.round(n / 2.20462 * 10) / 10;   // libras anotadas en máquina → kg
const SEED_SPLIT = {
  1: ['Anterior A', [
    ['Press plano máquina', 2, 9, 45, 2.5], ['Press inclinado', 2, 9, 15, 2.5],
    ['Pec deck unilateral', 1, 9, KG(60), 2.5], ['Elevaciones laterales', 3, 9, 15, 1],
    ['Press militar máquina', 2, 9, 22.5, 2.5], ['Extensión tríceps unilateral', 2, 9, 25, 2.5],
    ['JM press unilateral', 2, 9, 20, 2.5], ['Leg press', 3, 9, 180, 5],
    ['Leg extension', 2, 9, KG(165), 2.5], ['Abs polea', 2, 9, 59, 2.5]]],
  2: ['Posterior A', [
    ['Jalón ancho', 2, 9, 80, 5], ['Remo espalda alta', 3, 9, 42.5, 2.5],
    ['Remo neutro', 2, 9, 55, 2.5], ['Curl predicador', 2, 9, 14, 2],
    ['Curl martillo', 2, 9, 14, 2], ['SLDL', 2, 9, 35, 2.5],
    ['Hamstring curl', 3, 9, 70, 5], ['Hip thrust', 2, 9, 55, 5],
    ['Standing calf raise', 3, 9, KG(147.5), 2.5]]],
  4: ['Anterior B', [
    ['Press plano máquina', 1, 9, 45, 2.5], ['Pec deck unilateral', 2, 9, KG(60), 2.5],
    ['Press inclinado', 2, 9, 15, 2.5], ['Elevaciones laterales', 3, 9, 15, 1],
    ['Press militar máquina', 2, 9, 22.5, 2.5], ['Extensión tríceps unilateral', 2, 9, 25, 2.5],
    ['JM press unilateral', 2, 9, 20, 2.5], ['Leg press', 3, 9, 180, 5],
    ['Leg extension', 2, 9, KG(165), 2.5], ['Abs polea', 2, 9, 59, 2.5]]],
  5: ['Posterior B', [
    ['Jalón ancho', 2, 9, 80, 5], ['Remo espalda alta', 3, 9, 42.5, 2.5],
    ['Remo neutro', 2, 9, 55, 2.5], ['Curl martillo', 2, 9, 14, 2],
    ['Curl predicador', 2, 9, 14, 2], ['Hamstring curl', 3, 9, 70, 5],
    ['Back extension 45°', 2, 9, 75, 5], ['Hip thrust', 3, 9, 55, 5],
    ['Standing calf raise', 2, 9, KG(147.5), 2.5], ['Aductor', 2, 9, 55, 5],
    ['Abductor', 2, 9, 55, 5]]],
};
/* semana de nutrición tal como quedó anotada: los días "incompletos" entran
   incompletos a propósito, esa fuga es parte del dato */
const SEED_MEALS = {
  '2026-07-13': [['Pre-workout (5:35am)', 293, 0, 73.3, 0, '05:35']],
  '2026-07-14': [['Desayuno', 520, 28, 62, 17, '07:30'], ['Chifa combinado', 1120, 45, 155, 33, '13:00'],
                  ['Yogurt + fruta', 280, 18, 42, 4, '17:00'], ['Pollo + arroz', 526, 44.8, 58.8, 16.2, '20:30']],
  '2026-07-15': [['Desayuno', 480, 30, 55, 14, '07:30'], ['Milanesa', 720, 42, 78, 26, '13:00'],
                  ['Snack proteico', 240, 20, 30, 4, '17:00'], ['Pollo + arroz', 542, 45, 62, 15, '20:30']],
  '2026-07-16': [['Hamburguesa + milanesa + leche chocolatada', 1180, 52, 118, 52, '09:00']],
  '2026-07-17': [['Desayuno', 460, 28, 54, 13, '07:30'], ['Arroz tapado', 880, 44, 108, 28, '13:00'],
                  ['Powerade (parcial)', 150, 0, 38, 0, '16:00'], ['Cena', 579, 52, 60, 18, '20:30']],
  '2026-07-18': [['Desayuno', 500, 30, 58, 15, '07:30'], ['Spaghetti', 820, 36, 118, 22, '13:00'],
                  ['Tortillas', 320, 14, 34, 14, '17:00'], ['Milanesa + arroz', 472, 44, 48, 14, '20:30']],
};
const SEED_BODY = [['2026-06-01', 72.6, 80, 33.5], ['2026-06-08', 72.9], ['2026-06-15', 73.1],
  ['2026-06-22', 73.0], ['2026-06-29', 73.4], ['2026-07-06', 73.7], ['2026-07-13', 74.0],
  ['2026-07-20', 74.2, 79, 34]];
const SEED_WEEKS = 5, SEED_REF = 2;   // ~1 mes; los pesos anotados corresponden a hace 2 semanas

function genBodyForWindow() {
  const anchors = SEED_BODY.map(([date, weight, waist, arm]) => ({ t: +new Date(date + 'T00:00:00'), weight, waist, arm }));
  const out = [...SEED_BODY];
  const start = anchors[0].t, end = anchors[anchors.length - 1].t;
  for (let t = start; t <= end; t += 2 * 86400000) {
    if (anchors.some(a => Math.abs(a.t - t) < 86400000)) continue;
    let lo = anchors[0], hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) if (anchors[i].t <= t && t <= anchors[i + 1].t) { lo = anchors[i]; hi = anchors[i + 1]; break; }
    const frac = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
    const base = lo.weight + (hi.weight - lo.weight) * frac;
    const noise = (Math.random() - 0.5) * 0.8;
    out.push([dstr(new Date(t)), Math.round((base + noise) * 10) / 10]);
  }
  return out.sort((a, b) => a[0] < b[0] ? -1 : 1);
}

const MEAL_POOL = [
  ['Desayuno', 480, 28, 58, 15], ['Pollo + arroz', 530, 45, 58, 16], ['Milanesa', 720, 42, 78, 26],
  ['Ensalada + pollo', 380, 38, 20, 14], ['Yogurt + fruta', 260, 18, 38, 4],
  ['Arroz tapado', 860, 44, 106, 28], ['Spaghetti', 800, 35, 116, 22], ['Snack proteico', 230, 20, 28, 4],
];
function genMealsForDay(date, goals) {
  const roll = Math.random();
  if (roll < 0.08) {
    const big = MEAL_POOL[Math.floor(Math.random() * MEAL_POOL.length)];
    return [[big[0] + ' (día libre)', Math.round(goals.kcal * 1.3), Math.round(goals.p * .6), Math.round(goals.c * 1.4), Math.round(goals.f * 1.5), '13:30']];
  }
  const n = roll < 0.15 ? 2 : 4;
  const picks = [...MEAL_POOL].sort(() => Math.random() - 0.5).slice(0, n);
  const times = ['07:30', '13:00', '17:00', '20:30'];
  const scale = (goals.kcal / n) / 500;
  return picks.map((m, i) => {
    const jitter = 0.88 + Math.random() * 0.24;
    const f = scale * jitter;
    return [m[0], Math.round(m[1] * f), Math.round(m[2] * f), Math.round(m[3] * f), Math.round(m[4] * f), times[i] || '20:00'];
  });
}

function seedSessions() {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  Object.keys(SEED_SPLIT).forEach(k => {
    const wd = +k, [dayName, list] = SEED_SPLIT[wd];
    const exs = S.routine[wd].exercises;
    const iRef = SEED_WEEKS - 1 - SEED_REF;
    for (let i = 0; i < SEED_WEEKS; i++) {
      /* día salteado de tanto en tanto (ocupado/enfermo) — nunca la semana más reciente */
      if (i < SEED_WEEKS - 1 && Math.random() < 0.15) continue;
      const back = (SEED_WEEKS - 1 - i) * 7 + ((today.getDay() - wd + 7) % 7);
      const d = new Date(today); d.setDate(today.getDate() - back);
      if (d > today) continue;
      const cyc = i % 3, reps = [6, 7, 9][cyc];
      /* 20% de las semanas queda "en meseta": un escalón atrás del progreso esperado */
      const stepBase = Math.floor(i / 3) - Math.floor(iRef / 3);
      const step = Math.random() < 0.2 ? Math.max(0, stepBase - 1) : stepBase;
      const entries = exs.map((ex, n) => {
        const [, , , wRec, inc] = list[n];
        const noise = (Math.random() - 0.5) * (inc / 2);
        const w = Math.max(inc, Math.round((wRec + step * inc + noise) / (inc / 2)) * (inc / 2));
        const sets = [];
        for (let sN = 0; sN < ex.sets; sN++) sets.push({ w, r: sN ? Math.max(5, reps - 1) : reps, t: d.getTime() });
        return { exId: ex.id, name: ex.name, sets };
      });
      const nsets = entries.reduce((a, e) => a + e.sets.length, 0);
      const dur = Math.round(nsets * 2.9 + 8);
      const start = new Date(d); start.setHours(6, 0, 0, 0);
      out.push({
        id: uid(), date: dstr(d), weekday: wd, dayName, seed: true,
        start: start.getTime(), end: start.getTime() + dur * 60000, duration: dur, entries,
      });
    }
  });
  return out.sort((a, b) => b.start - a.start);
}

export async function seedRegistro() {
  for (const wd in SEED_SPLIT) {
    const [name, list] = SEED_SPLIT[wd];
    S.routine[wd] = {
      weekday: +wd, name, seed: true,
      exercises: list.map(([n, st, r]) => ({ id: uid(), name: n, sets: st, reps: r })),
    };
    await persistDay(+wd);
  }
  for (const s of seedSessions()) { await idb.put('sessions', s); S.sessions.push(s); }
  S.sessions.sort((a, b) => b.start - a.start);

  S.cfg.goals = { kcal: 1950, p: 140, c: 201, f: 65 };
  S.cfg.goalsAuto = false;

  for (const date in SEED_MEALS)
    for (const [name, kcal, p, c, f, t] of SEED_MEALS[date]) {
      const m = { id: uid(), date, name, kcal, p, c, f, t, seed: true };
      await idb.put('meals', m); S.meals.push(m);
    }
  const windowStart = new Date(); windowStart.setDate(windowStart.getDate() - SEED_WEEKS * 7);
  for (let d = new Date(windowStart); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const ds = dstr(d);
    if (SEED_MEALS[ds] || S.meals.some(m => m.date === ds && !m.seed)) continue;
    for (const [name, kcal, p, c, f, t] of genMealsForDay(ds, S.cfg.goals)) {
      const m = { id: uid(), date: ds, name, kcal, p, c, f, t, seed: true };
      await idb.put('meals', m); S.meals.push(m);
    }
  }

  for (const [date, weight, waist, arm] of genBodyForWindow()) {
    const b = { id: uid(), date, weight, waist: waist ?? null, arm: arm ?? null, chest: null, leg: null, seed: true };
    await idb.put('body', b); S.body.push(b);
  }
  S.body.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  S.cfg.profile.weightKg = 74;
  S.cfg.rest = 180;                  // 3 min, el descanso de compuestos
  S.cfg.routineName = 'Anterior / Posterior';
  await saveCfg();
  /* queda también en la biblioteca, para poder volver a ella tras probar otra */
  S.lib = S.lib.filter(r => r.name !== 'Anterior / Posterior');
  S.lib.unshift({ id: uid(), name: 'Anterior / Posterior', days: routineSnapshot(), savedAt: dstr() });
  await saveLib();
}

export function seedCount() {
  return S.sessions.filter(x => x.seed).length + S.meals.filter(x => x.seed).length
    + S.body.filter(x => x.seed).length;
}

export async function wipeSeed() {
  for (const st of ['sessions', 'meals', 'body']) {
    for (const r of await idb.all(st)) if (r.seed) await idb.del(st, r.id);
  }
  for (const wd in S.routine) if (S.routine[wd].seed) await idb.del('routine', S.routine[wd].weekday);
}
