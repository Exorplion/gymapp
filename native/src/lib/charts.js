// Puerto de las funciones de análisis de progreso desde web/src/lib/charts.js
// SÓLO lógica pura (sin drawChart/pickChartPoint de canvas)
// framework-agnostic — sólo importa DE state.js/format.js, nunca al revés.
import { S } from './state.js';
import { round1, fmtNum, fmtD, norm } from './format.js';

/* ================= peso: promedio semanal (Sección 20) ================= */
export function weeklyAvg() {
  const ws = S.body.filter(b => b.weight != null);
  if (!ws.length) return null;
  const end = new Date(ws[ws.length - 1].date + 'T12:00:00');
  const daysAgo = d => (end - new Date(d + 'T12:00:00')) / 86400000;
  const cur = ws.filter(b => { const g = daysAgo(b.date); return g >= 0 && g < 7; });
  const prev = ws.filter(b => { const g = daysAgo(b.date); return g >= 7 && g < 14; });
  const avg = a => a.length ? a.reduce((s, b) => s + b.weight, 0) / a.length : null;
  const curAvg = avg(cur), prevAvg = avg(prev);
  return { curAvg, prevAvg, n: cur.length, delta: (curAvg != null && prevAvg != null) ? round1(curAvg - prevAvg) : null, last: ws[ws.length - 1] };
}

/* ================= PROGRESO ================= */
export function exerciseSeries() {
  // nombre -> [{date, best(vol), maxW, w, r}] ascendente
  const map = {};
  [...S.sessions].sort((a, b) => a.start - b.start).forEach(s => {
    (s.entries || []).forEach(e => {
      let best = 0, maxW = 0, bestSet = null;
      e.sets.forEach(st => {
        if (st.w * st.r > best) { best = st.w * st.r; bestSet = st; }
        maxW = Math.max(maxW, st.w);
      });
      if (!best) return;
      const key = e.name.trim();
      (map[key] = map[key] || []).push({ date: s.date, best, maxW, w: bestSet.w, r: bestSet.r });
    });
  });
  return map;
}
export const RANGE_DAYS = { '1m': 30, '3m': 90, '6m': 180 };
export function filterByRange(pts, range) {
  if (!range || range === 'all') return pts;
  const cutoff = Date.now() - RANGE_DAYS[range] * 86400000;
  return pts.filter(p => +new Date(p.date + 'T00:00:00') >= cutoff);
}

/* ---------- análisis de fuerza (Sección 21) ----------
   1RM estimado con Epley. La fórmula se desvía con series largas, así que las
   de más de 12 reps no entran en la tendencia. */
export const e1rm = (w, r) => r <= 1 ? w : w * (1 + r / 30);
/* mejor 1RM estimado por sesión, en orden cronológico (S.sessions viene al revés) */
export function e1rmSeries(name) {
  const key = norm(name), out = [];
  [...S.sessions].reverse().forEach(s => {
    let best = 0;
    (s.entries || []).forEach(e => {
      if (norm(e.name) !== key) return;
      e.sets.forEach(st => { if (st.r <= 12) { const v = e1rm(st.w, st.r); if (v > best) best = v; } });
    });
    if (best > 0) out.push({ date: s.date, y: best });
  });
  return out;
}
/* regresión lineal de kg contra días. Devuelve también R²: sin él no se puede
   distinguir una progresión real de una nube de puntos con ruido. */
export function trend(pts) {
  if (pts.length < 4) return null;
  const t0 = new Date(pts[0].date + 'T12:00:00').getTime();
  const xs = pts.map(p => (new Date(p.date + 'T12:00:00').getTime() - t0) / 86400000), ys = pts.map(p => p.y);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (!den) return null;
  const slope = num / den, intercept = my - slope * mx;
  const ss = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  let res = 0;
  for (let i = 0; i < n; i++) res += (ys[i] - (intercept + slope * xs[i])) ** 2;
  return { slope, r2: ss ? 1 - res / ss : 0, n, last: ys[n - 1], days: xs[n - 1] };
}
/* Proyección deliberadamente conservadora. Extrapolar la pendiente medida en
   línea recta da números de fantasía: 5 sesiones de novato dan +3 kg/semana, que
   a 4 semanas proyecta +13 kg. Ese ritmo no se sostiene. Se limita a 1 %/semana
   del 1RM actual (techo realista sostenido) y se exige una tendencia con señal
   (R² ≥ .5) sobre al menos 4 sesiones. */
export function project(t, weeks) {
  if (!t || t.n < 4 || t.r2 < 0.5 || t.slope <= 0) return null;
  const cap = t.last * 0.01, measured = t.slope * 7, perWeek = Math.min(measured, cap);
  return { perWeek, measured, value: t.last + perWeek * weeks, capped: measured > cap };
}
/* una línea honesta por ejercicio: subiendo / plano / bajando, y a qué ritmo */
export function strengthReadout() {
  const names = [...new Set(S.sessions.flatMap(s => (s.entries || []).map(e => e.name.trim())))];
  return names.map(n => {
    const pts = e1rmSeries(n), t = trend(pts);
    return { name: n, pts, t, last: pts.length ? pts[pts.length - 1].y : 0 };
  }).filter(x => x.pts.length >= 2).sort((a, b) => b.last - a.last);
}
