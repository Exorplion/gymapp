// Puerto verbatim de web/src/lib/streak.js — JS puro, sin cambios.
//
// currentStreak() incluye el cap MAX_STREAK_LOOKBACK_DAYS que se porta tal
// cual: es la protección contra el bucle infinito que ya mordió una vez en
// la PWA (dayCompleted() puede devolver null indefinidamente cuando el
// turno pendiente es de descanso, sin importar qué tan atrás se camine) —
// no reimplementar el loop desde cero.
import { S } from './state.js';
import { dstr, fmtDFull } from './format.js';

/** Un día "cumplido" mira qué turno de la secuencia estaba pendiente esa
    fecha (aproximado por S.cfg.seqIndexDate: el turno vigente cuando
    seqIndex cambió por última vez) — si es descanso, no cuenta ni corta;
    si es entrenamiento, cumple si hay una sesión de ESE turno esa fecha. */
export function dayCompleted(dateStr) {
  // Sólo se puede evaluar con precisión el turno vigente ahora mismo (no
  // se reconstruye el puntero histórico completo — ver nota de diseño).
  // Para `dateStr === S.cfg.seqIndexDate` (el día en que el puntero quedó
  // en su valor actual) esto es exacto; para fechas más viejas se usa la
  // misma aproximación, consistente con "sólo aplica desde la migración".
  const slot = S.routine[S.cfg.seqIndex];
  if (!slot || slot.type === 'rest') return null;
  return S.sessions.some(s => s.slotId === slot.id && s.date === dateStr);
}

// Cota dura para el retroceso día a día: dayCompleted() ya no depende de
// la fecha pedida cuando el turno pendiente es de descanso (lee siempre
// S.routine[S.cfg.seqIndex]), así que puede devolver null indefinidamente
// sin importar qué tan atrás se camine — el loop necesita un límite que no
// dependa de que dayCompleted() alguna vez deje de ser null.
const MAX_STREAK_LOOKBACK_DAYS = 3650; // ~10 años

export function currentStreak() {
  if (!S.routine.some(s => s.type === 'workout' && s.exercises?.length)) return 0;
  const todayStr = dstr();
  let n = 0, d = new Date(), first = true;
  for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
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
