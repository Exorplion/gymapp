// Puerto de funciones de volumen muscular desde index.html
import { S } from './state.js';
import { dstr, norm } from './format.js';

/** Base de ejercicios para el selector de "Nuevo ejercicio" */
export const EXCATALOG = [
  { c: 'Pecho', n: 'Press banca' }, { c: 'Pecho', n: 'Press inclinado mancuernas' }, { c: 'Pecho', n: 'Aperturas en polea' },
  { c: 'Pecho', n: 'Fondos' }, { c: 'Pecho', n: 'Press declinado' },
  { c: 'Espalda', n: 'Dominadas' }, { c: 'Espalda', n: 'Remo con barra' }, { c: 'Espalda', n: 'Jalón al pecho' },
  { c: 'Espalda', n: 'Remo en polea' }, { c: 'Espalda', n: 'Peso muerto' },
  { c: 'Hombro', n: 'Press militar' }, { c: 'Hombro', n: 'Elevaciones laterales' }, { c: 'Hombro', n: 'Pájaros' }, { c: 'Hombro', n: 'Face pull' },
  { c: 'Bíceps', n: 'Curl con barra' }, { c: 'Bíceps', n: 'Curl martillo' }, { c: 'Bíceps', n: 'Curl inclinado' },
  { c: 'Tríceps', n: 'Extensión tríceps polea' }, { c: 'Tríceps', n: 'Extensión sobre cabeza' },
  { c: 'Pierna', n: 'Sentadilla' }, { c: 'Pierna', n: 'Prensa' }, { c: 'Pierna', n: 'Peso muerto rumano' },
  { c: 'Pierna', n: 'Extensiones de cuádriceps' }, { c: 'Pierna', n: 'Curl femoral' }, { c: 'Pierna', n: 'Zancadas' },
  { c: 'Glúteo', n: 'Hip thrust' }, { c: 'Gemelos', n: 'Elevación de gemelos' },
  { c: 'Abs', n: 'Crunch en polea' }, { c: 'Abs', n: 'Rueda abdominal' },
];

/** Categoría muscular del ejercicio, reutilizando el catálogo del selector */
export function catOf(name) {
  const n = norm(name); let best = null, len = 0;
  for (const e of EXCATALOG) { const ne = norm(e.n); if (n.includes(ne) && ne.length > len) { best = e.c; len = ne.length; } }
  return best;
}

export function muscleVolume(days) {
  const cutoff = dstr(new Date(Date.now() - days * 86400000)), tally = {};
  S.sessions.filter(s => s.date >= cutoff).forEach(s => (s.entries || []).forEach(e => {
    const c = catOf(e.name); if (c) tally[c] = (tally[c] || 0) + e.sets.length;
  }));
  return tally;
}
