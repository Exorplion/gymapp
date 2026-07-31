// Puerto de los helpers de parseo de "registro retroactivo por voz"
// (index.html: NUMWORDS/digitize/voiceCandidates/matchAt/parseWorkoutSpeech).
// Funciones puras (dado un texto, devuelven candidatos/objetos) separadas del
// componente VoiceLog.jsx a propósito, tal como pide task-6-brief.md — no
// dependen de React.
//
// Nota de import: este archivo importa lastDataFor desde session.js (para
// prellenar el peso sugerido de cada ítem reconocido). session.js NO importa
// nada de acá, así que la dependencia es unidireccional — sin ciclo.
import { S } from './state.js';
import { norm, round1 } from './format.js';
import { EXCATALOG } from './muscle.js';
import { lastDataFor } from './session.js';

/** El dictado devuelve los números como palabras ("cuatro por ocho"), así
    que primero se pasan a dígitos. */
export const NUMWORDS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30,
};

export function digitize(t) {
  let s = ' ' + norm(t).replace(/[.,;]/g, ' ') + ' ';
  for (const [w, n] of Object.entries(NUMWORDS)) s = s.split(' ' + w + ' ').join(' ' + n + ' ');
  return s;
}

/** Candidatos: primero los ejercicios de tu propia rutina, que son los
    probables. */
export function voiceCandidates() {
  const list = [];
  Object.values(S.routine).forEach(d => (d.exercises || []).forEach(e => list.push(e.name)));
  EXCATALOG.forEach(e => list.push(e.n));
  return [...new Set(list.map(n => n.trim()))];
}

/** Coincidencia por tokens, no por texto exacto: así "press de banca"
    encuentra "Press banca". Para nombres de varias palabras se exigen al
    menos dos tokens, si no "press" solo coincidiría con banca, militar e
    inclinado a la vez. */
export function matchAt(t, name) {
  const toks = norm(name).split(/\s+/).filter(w => w.length > 2);
  if (!toks.length) return null;
  const first = t.indexOf(toks[0]);
  if (first < 0) return null;
  let pos = first + toks[0].length, last = pos, score = 1;
  for (let i = 1; i < toks.length; i++) {
    const p = t.indexOf(toks[i], pos);
    if (p < 0 || p - pos > 20) break;
    pos = p + toks[i].length; last = pos; score++;
  }
  if (toks.length > 1 && score < 2) return null;
  return { at: first, end: last, score };
}

export function parseWorkoutSpeech(text) {
  const t = digitize(text), hits = [];
  voiceCandidates().forEach(name => {
    const m = matchAt(t, name);
    if (m) hits.push({ name, ...m });
  });
  /* ante solapamientos gana el nombre más específico (más tokens, más largo) */
  hits.sort((a, b) => a.at - b.at || b.score - a.score || (b.end - b.at) - (a.end - a.at));
  const picked = [];
  hits.forEach(hh => {
    if (picked.some(p => hh.at < p.end && hh.end > p.at)) return;
    picked.push(hh);
  });
  picked.sort((a, b) => a.at - b.at);
  return picked.map((p, i) => {
    const end = i + 1 < picked.length ? picked[i + 1].at : t.length;
    const nums = (t.slice(p.end, end).match(/\d+/g) || []).map(Number).filter(n => n > 0 && n <= 200);
    /* patrón hablado habitual: "<series> por / series de <reps>" */
    return {
      name: p.name, sets: Math.min(12, nums[0] || 3), reps: Math.min(50, nums[1] || 10),
      w: round1((lastDataFor(p.name)?.[0]?.w) || 20),
    };
  });
}
