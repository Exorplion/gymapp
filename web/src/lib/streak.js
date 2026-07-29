// Puerto de funciones de racha desde index.html
import { S } from './state.js';
import { dstr, fmtDFull } from './format.js';

/** Un día "cumplido" necesita rutina asignada Y una sesión guardada esa fecha;
    los días de descanso (sin rutina) no cuentan ni cortan la racha */
export function dayCompleted(dateStr) {
  const wd = new Date(dateStr + 'T12:00:00').getDay();
  if (!S.routine[wd]?.exercises?.length) return null;
  return S.sessions.some(s => s.date === dateStr);
}

export function currentStreak() {
  if (!Object.values(S.routine).some(d => d.exercises?.length)) return 0;
  const todayStr = dstr();
  let n = 0, d = new Date(), first = true;
  for (;;) {
    const ds = dstr(d);
    const c = dayCompleted(ds);
    if (c === null) { d.setDate(d.getDate() - 1); first = false; continue; }
    if (c === false) {
      if (first && ds === todayStr) { d.setDate(d.getDate() - 1); first = false; continue; }
      break;
    }
    n++; d.setDate(d.getDate() - 1); first = false;
  }
  return n;
}

export function bestStreak() {
  if (!S.sessions.length) return 0;
  const dates = S.sessions.map(s => s.date);
  let d = new Date(dates.reduce((a, b) => a < b ? a : b) + 'T12:00:00');
  const endStr = dstr();
  let cur = 0, best = 0;
  while (dstr(d) <= endStr) {
    const c = dayCompleted(dstr(d));
    if (c === true) { cur++; best = Math.max(best, cur); }
    else if (c === false) { cur = 0; }
    d.setDate(d.getDate() + 1);
  }
  return best;
}

export function streakHeatmap() {
  const days = []; let done = 0, total = 0;
  for (let i = 55; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = dstr(d);
    const c = dayCompleted(ds);
    if (c !== null) { total++; if (c) done++; }
    days.push({ date: ds, status: c === null ? 'rest' : c ? 'done' : 'miss' });
  }
  return { days, pct: total ? Math.round(done / total * 100) : 0 };
}
