// Puerto de las funciones del "motor de gráficos" y del análisis de progreso
// desde index.html (secciones "peso: promedio semanal", "PROGRESO" y
// "gráfico canvas"). Todo acá es cálculo puro + dibujo canvas 2D
// framework-agnostic — no toca el DOM salvo el <canvas> que recibe como
// argumento (drawChart/pickChartPoint), así que no hay riesgo de ciclo con
// state.js: sólo se importa DE state.js/format.js, nunca al revés.
import { S } from './state.js';
import { round1, fmtNum, fmtD, norm } from './format.js';

interface BodyEntry { date: string; weight: number | null; }
interface SetEntry { w: number; r: number; }
interface SessionEntry { name: string; sets: SetEntry[]; }
interface Session { date: string; start: number; entries?: SessionEntry[]; }

const sessions = (): Session[] => S.sessions as Session[];
const body = (): BodyEntry[] => S.body as BodyEntry[];

/* ================= peso: promedio semanal (Sección 20) ================= */
export interface WeeklyAvg {
  curAvg: number | null;
  prevAvg: number | null;
  n: number;
  delta: number | null;
  last: BodyEntry;
}
export function weeklyAvg(): WeeklyAvg | null {
  const ws = body().filter(b => b.weight != null);
  if (!ws.length) return null;
  const end = new Date(ws[ws.length - 1].date + 'T12:00:00');
  const daysAgo = (d: string) => (end.getTime() - new Date(d + 'T12:00:00').getTime()) / 86400000;
  const cur = ws.filter(b => { const g = daysAgo(b.date); return g >= 0 && g < 7; });
  const prev = ws.filter(b => { const g = daysAgo(b.date); return g >= 7 && g < 14; });
  const avg = (a: BodyEntry[]): number | null => a.length ? a.reduce((s, b) => s + (b.weight as number), 0) / a.length : null;
  const curAvg = avg(cur), prevAvg = avg(prev);
  return { curAvg, prevAvg, n: cur.length, delta: (curAvg != null && prevAvg != null) ? round1(curAvg - prevAvg) : null, last: ws[ws.length - 1] };
}

/* ================= PROGRESO ================= */
export interface SeriesPoint { date: string; best: number; maxW: number; w: number; r: number; }
export function exerciseSeries(): Record<string, SeriesPoint[]> {
  // nombre -> [{date, best(vol), maxW, w, r}] ascendente
  const map: Record<string, SeriesPoint[]> = {};
  [...sessions()].sort((a, b) => a.start - b.start).forEach(s => {
    (s.entries || []).forEach(e => {
      let best = 0, maxW = 0, bestSet: SetEntry | null = null;
      e.sets.forEach(st => {
        if (st.w * st.r > best) { best = st.w * st.r; bestSet = st; }
        maxW = Math.max(maxW, st.w);
      });
      if (!best || !bestSet) return;
      const key = e.name.trim();
      (map[key] = map[key] || []).push({ date: s.date, best, maxW, w: (bestSet as SetEntry).w, r: (bestSet as SetEntry).r });
    });
  });
  return map;
}
export const RANGE_DAYS: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180 };
export function filterByRange<T extends { date: string }>(pts: T[], range?: string | null): T[] {
  if (!range || range === 'all') return pts;
  const cutoff = Date.now() - RANGE_DAYS[range] * 86400000;
  return pts.filter(p => +new Date(p.date + 'T00:00:00') >= cutoff);
}

/* ---------- análisis de fuerza (Sección 21) ----------
   1RM estimado con Epley. La fórmula se desvía con series largas, así que las
   de más de 12 reps no entran en la tendencia. */
export const e1rm = (w: number, r: number): number => r <= 1 ? w : w * (1 + r / 30);

export interface E1rmPoint { date: string; y: number; }
/* mejor 1RM estimado por sesión, en orden cronológico (S.sessions viene al revés) */
export function e1rmSeries(name: string): E1rmPoint[] {
  const key = norm(name), out: E1rmPoint[] = [];
  [...sessions()].reverse().forEach(s => {
    let best = 0;
    (s.entries || []).forEach(e => {
      if (norm(e.name) !== key) return;
      e.sets.forEach(st => { if (st.r <= 12) { const v = e1rm(st.w, st.r); if (v > best) best = v; } });
    });
    if (best > 0) out.push({ date: s.date, y: best });
  });
  return out;
}

export interface Trend { slope: number; r2: number; n: number; last: number; days: number; }
/* regresión lineal de kg contra días. Devuelve también R²: sin él no se puede
   distinguir una progresión real de una nube de puntos con ruido. */
export function trend(pts: E1rmPoint[]): Trend | null {
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

export interface Projection { perWeek: number; measured: number; value: number; capped: boolean; }
/* Proyección deliberadamente conservadora. Extrapolar la pendiente medida en
   línea recta da números de fantasía: 5 sesiones de novato dan +3 kg/semana, que
   a 4 semanas proyecta +13 kg. Ese ritmo no se sostiene. Se limita a 1 %/semana
   del 1RM actual (techo realista sostenido) y se exige una tendencia con señal
   (R² ≥ .5) sobre al menos 4 sesiones. */
export function project(t: Trend | null, weeks: number): Projection | null {
  if (!t || t.n < 4 || t.r2 < 0.5 || t.slope <= 0) return null;
  const cap = t.last * 0.01, measured = t.slope * 7, perWeek = Math.min(measured, cap);
  return { perWeek, measured, value: t.last + perWeek * weeks, capped: measured > cap };
}

export interface StrengthReadout { name: string; pts: E1rmPoint[]; t: Trend | null; last: number; }
/* una línea honesta por ejercicio: subiendo / plano / bajando, y a qué ritmo */
export function strengthReadout(): StrengthReadout[] {
  const names = [...new Set(sessions().flatMap(s => (s.entries || []).map(e => e.name.trim())))];
  return names.map(n => {
    const pts = e1rmSeries(n), t = trend(pts);
    return { name: n, pts, t, last: pts.length ? pts[pts.length - 1].y : 0 };
  }).filter(x => x.pts.length >= 2).sort((a, b) => b.last - a.last);
}

/* ---------- bandas de volumen (Plan Fierro · Fase 1) ----------
   Umbrales de Renaissance Periodization (Mike Israetel): MEV (mínimo
   efectivo), MAV (rango que de verdad hace crecer) y MRV (máximo
   recuperable), en series semanales por grupo. Varían por grupo porque no
   todos los músculos toleran ni necesitan el mismo volumen — Pecho y
   Espalda aguantan mucho más que Abs o Gemelos. */
export interface VolumeBand { mev: number; mav: number; mrv: number; }
export const VOLUME_BANDS: Record<string, VolumeBand> = {
  Pecho: { mev: 8, mav: 16, mrv: 22 },
  Espalda: { mev: 10, mav: 18, mrv: 25 },
  Hombro: { mev: 8, mav: 18, mrv: 24 },
  Bíceps: { mev: 6, mav: 16, mrv: 22 },
  Tríceps: { mev: 6, mav: 14, mrv: 20 },
  Pierna: { mev: 8, mav: 16, mrv: 22 },
  Glúteo: { mev: 4, mav: 12, mrv: 18 },
  Gemelos: { mev: 6, mav: 14, mrv: 20 },
  Abs: { mev: 0, mav: 12, mrv: 20 },
};

export type VolumeBandLabel = 'bajo' | 'efectivo' | 'cerca-max' | 'excedido';
/** En qué banda cae un volumen semanal (series) para un grupo: 'bajo' (por
    debajo del mínimo efectivo), 'efectivo' (MEV-MAV, el rango que hace
    crecer), 'cerca-max' (MAV-MRV, cerca del techo recuperable) o
    'excedido' (MRV o más). Un grupo sin tabla propia usa un genérico
    razonable en vez de fallar. */
export function volumeBand(cat: string, sets: number): VolumeBandLabel {
  const b = VOLUME_BANDS[cat] || { mev: 8, mav: 16, mrv: 22 };
  if (sets < b.mev) return 'bajo';
  if (sets < b.mav) return 'efectivo';
  if (sets < b.mrv) return 'cerca-max';
  return 'excedido';
}

/* ---------- fuerza en contexto: ratio contra peso corporal ----------
   Tiers aproximados de Strength Level / Symmetric Strength para los cuatro
   levantamientos con estándares ampliamente publicados y reconocibles por
   nombre, como múltiplo del peso corporal (1RM estimado ÷ peso). */
interface StrengthMove { key: string; match: (n: string) => boolean; tiers: number[]; }
const STRENGTH_MOVES: StrengthMove[] = [
  { key: 'sentadilla', match: n => /sentadilla|squat/i.test(n) && !/hack|leg\s*press/i.test(n), tiers: [0.75, 1.25, 1.75, 2.25] },
  { key: 'peso muerto', match: n => /(peso muerto|deadlift)/i.test(n) && !/(rumano|sldl|rdl)/i.test(n), tiers: [1.0, 1.5, 2.0, 2.5] },
  { key: 'press banca', match: n => /(press banca|bench)/i.test(n) && !/(inclinado|declinado|incline|decline)/i.test(n), tiers: [0.5, 0.9, 1.25, 1.5] },
  { key: 'press militar', match: n => /(press militar|overhead press|military press)/i.test(n), tiers: [0.35, 0.55, 0.75, 1.0] },
];
const TIER_LABELS = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'];

export interface StrengthTier { label: string; ratio: number; }
/** Si `name` es uno de los cuatro grandes, el tier de fuerza y el ratio (PR
    ÷ peso corporal) — null si no es uno de esos cuatro, o si falta el peso
    corporal para calcularlo. Ningún dato nuevo: es una división sobre lo
    que ya se registra. */
export function strengthTier(name: string, prWeight: number, bodyWeight: number): StrengthTier | null {
  if (!(prWeight > 0) || !(bodyWeight > 0)) return null;
  const move = STRENGTH_MOVES.find(m => m.match(name));
  if (!move) return null;
  const ratio = prWeight / bodyWeight;
  let tier = 0;
  for (let i = 0; i < move.tiers.length; i++) if (ratio >= move.tiers[i]) tier = i;
  return { label: TIER_LABELS[tier], ratio: Math.round(ratio * 100) / 100 };
}

/* ---------- peso sugerido por % de 1RM (Plan Fierro · Fase 3) ----------
   Patrón de 5/3/1 y plataformas VBT: programar por porcentaje del máximo
   ACTUAL (el e1RM más reciente), no un número fijo que envejece. RIR 2-3
   (esfuerzo cómodo, series de trabajo normales) ronda 75-85% del 1RM —
   se usa 80% como punto medio razonable por defecto. */
export function suggestedWeight(name: string, pct = 0.8): number | null {
  const pts = e1rmSeries(name);
  if (!pts.length) return null;
  const last = pts[pts.length - 1].y;
  return Math.round(last * pct * 4) / 4; // redondeo a 0.25kg, ajustable con discos chicos
}

/* ---------- ACWR: riesgo por salto brusco de volumen (Plan Fierro · Fase 2) ----------
   Acute:Chronic Workload Ratio (Gabbett et al.): tonelaje de los últimos 7
   días contra el promedio semanal de las últimas 4 semanas. ≥1.5 es la zona
   de riesgo de sobreentrenamiento validada en literatura de prevención de
   lesiones deportivas. */
function tonnageInRange(fromMs: number, toMs: number): number {
  let kg = 0;
  for (const s of sessions()) {
    if (s.start < fromMs || s.start >= toMs) continue;
    for (const e of s.entries || []) for (const st of e.sets || []) kg += (st.w || 0) * (st.r || 0);
  }
  return kg;
}
export interface Acwr { acute: number; chronicAvg: number; ratio: number; risk: boolean; }
/** null si todavía no hay 4 semanas de historial — nada con qué comparar. */
export function acwr(): Acwr | null {
  const now = Date.now();
  const acute = tonnageInRange(now - 7 * 86400000, now);
  const chronicAvg = tonnageInRange(now - 28 * 86400000, now) / 4;
  if (!chronicAvg) return null;
  return { acute: Math.round(acute), chronicAvg: Math.round(chronicAvg), ratio: Math.round((acute / chronicAvg) * 100) / 100, risk: acute / chronicAvg >= 1.5 };
}

/* ================= gráfico canvas ================= */
interface ChartPoint { date: string; y: number; r?: number; }
interface DrawChartOpts { unit?: string; }
export const CHART_SEL = new WeakMap<HTMLCanvasElement, number>();

type ChartCanvas = HTMLCanvasElement & { _pts?: ChartPoint[] | null; _X?: (d: string) => number };

export function drawChart(cv: ChartCanvas, pts: ChartPoint[], opts: DrawChartOpts = {}): void {
  const dpr = devicePixelRatio || 1;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 200;
  cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d')!; x.scale(dpr, dpr);
  x.clearRect(0, 0, W, H);
  if (pts.length < 2) {
    x.fillStyle = '#5C6885'; x.font = '500 14px Barlow, sans-serif'; x.textAlign = 'center';
    x.fillText(pts.length ? 'Registra al menos 2 puntos para ver la curva' : 'Sin datos todavía', W / 2, H / 2);
    cv._pts = null;
    return;
  }
  const P = { l: 46, r: 16, t: 24, b: 26 };
  const ys = pts.map(p => p.y);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mn === mx) { mn -= 1; mx += 1; }
  const padY = (mx - mn) * .14; mn -= padY; mx += padY;
  const t0 = +new Date(pts[0].date + 'T00:00:00'), t1 = +new Date(pts[pts.length - 1].date + 'T00:00:00');
  const span = t1 - t0 || 1;
  const X = (d: string) => P.l + (W - P.l - P.r) * ((+new Date(d + 'T00:00:00')) - t0) / span;
  const Y = (v: number) => P.t + (H - P.t - P.b) * (1 - (v - mn) / (mx - mn));
  if (opts.unit) { x.font = '600 10px Barlow, sans-serif'; x.fillStyle = '#8B97B4'; x.textAlign = 'left'; x.fillText(opts.unit, 2, 12); }
  x.font = '500 11px Barlow, sans-serif';
  x.strokeStyle = 'rgba(120,150,220,.13)'; x.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const v = mn + (mx - mn) * i / 3, y = Y(v);
    x.beginPath(); x.moveTo(P.l, y); x.lineTo(W - P.r, y); x.stroke();
    x.fillStyle = '#6B7A99'; x.textAlign = 'right'; x.fillText(fmtNum(round1(v)), P.l - 8, y + 4);
  }
  x.textAlign = 'center'; x.fillStyle = '#6B7A99';
  x.fillText(fmtD(pts[0].date), Math.max(P.l + 16, X(pts[0].date)), H - 8);
  x.fillText(fmtD(pts[pts.length - 1].date), Math.min(W - P.r - 16, X(pts[pts.length - 1].date)), H - 8);
  const g = x.createLinearGradient(0, P.t, 0, H - P.b);
  g.addColorStop(0, 'rgba(62,150,255,.32)'); g.addColorStop(1, 'rgba(62,150,255,0)');
  x.beginPath();
  pts.forEach((p, i) => { const px = X(p.date); if (i) x.lineTo(px, Y(p.y)); else x.moveTo(px, Y(p.y)); });
  x.lineTo(X(pts[pts.length - 1].date), H - P.b); x.lineTo(X(pts[0].date), H - P.b); x.closePath();
  x.fillStyle = g; x.fill();
  x.beginPath();
  pts.forEach((p, i) => { const px = X(p.date); if (i) x.lineTo(px, Y(p.y)); else x.moveTo(px, Y(p.y)); });
  x.strokeStyle = '#3E96FF'; x.lineWidth = 2.5; x.lineJoin = 'round'; x.lineCap = 'round';
  x.shadowColor = 'rgba(62,150,255,.5)'; x.shadowBlur = 8;
  x.stroke(); x.shadowBlur = 0;
  const selIdx = Math.min(CHART_SEL.get(cv) ?? pts.length - 1, pts.length - 1);
  pts.forEach((p, i) => {
    const sel = i === selIdx, px = X(p.date);
    x.beginPath(); x.arc(px, Y(p.y), sel ? 4.5 : 3, 0, 7);
    x.fillStyle = sel ? '#8FC2FF' : '#3E96FF'; x.fill();
  });
  const sp = pts[selIdx], spx = X(sp.date);
  x.strokeStyle = 'rgba(143,194,255,.4)'; x.lineWidth = 5;
  x.beginPath(); x.arc(spx, Y(sp.y), 8, 0, 7); x.stroke();
  const valTxt = `${fmtNum(sp.y)}${opts.unit ? ' ' + opts.unit : ''}${sp.r ? ' × ' + sp.r : ''}`;
  x.fillStyle = '#EAF0FC'; x.font = '700 13px "Barlow Condensed", sans-serif'; x.textAlign = 'center';
  x.fillText(`${fmtD(sp.date)} · ${valTxt}`, spx, Math.max(14, Y(sp.y) - 14));
  cv._pts = pts; cv._X = X;
}
export function pickChartPoint(cv: ChartCanvas, clientX: number): void {
  const pts = cv._pts, X = cv._X; if (!pts || !X) return;
  const rect = cv.getBoundingClientRect();
  const px = clientX - rect.left;
  let best = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = Math.abs(X(p.date) - px); if (d < bd) { bd = d; best = i; } });
  CHART_SEL.set(cv, best);
}
