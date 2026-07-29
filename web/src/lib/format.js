// Utilidades de formato/fecha/número — puerto verbatim de index.html.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const KG2LB = 2.20462262;
export const pad = n => String(n).padStart(2, '0');
export const dstr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WDS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WD1 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const fmtD = s => `${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`;
export const fmtDFull = s => { const dt = new Date(s + 'T12:00:00'); return `${WDS[dt.getDay()]} ${+s.slice(8)} ${MO[+s.slice(5, 7) - 1]}`; };
export const round1 = n => Math.round(n * 10) / 10;
export const fmtNum = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
export const fmtMMSS = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
export const kg2lb = kg => round1(kg * KG2LB);
export const lb2kg = lb => lb / KG2LB;
export const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
export const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Funciones de peso — dependen de S.cfg.unit para mostrar kg o lb
export function wDisplay(kg) {
  const { S } = require('./state.js');
  return S.cfg.unit === 'kg' ? fmtNum(round1(kg)) : fmtNum(kg2lb(kg));
}

export function wAlt(kg) {
  const { S } = require('./state.js');
  return S.cfg.unit === 'kg' ? `${fmtNum(kg2lb(kg))} lb` : `${fmtNum(round1(kg))} kg`;
}

export function wBoth(kg) {
  return `${fmtNum(round1(kg))} kg · ${fmtNum(kg2lb(kg))} lb`;
}

export function wStep() {
  const { S } = require('./state.js');
  return S.cfg.unit === 'kg' ? 2.5 : 5 / KG2LB;
}
