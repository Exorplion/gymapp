// Ilustraciones del movimiento, desde free-exercise-db.
//
// Origen: https://github.com/yuhonas/free-exercise-db — 873 ejercicios con
// imágenes, bajo Unlicense (dominio público: sin atribución ni restricciones).
// Se eligió esa base y no fotos de máquinas de fabricantes porque esas últimas
// tienen derechos; ésta es libre de usar.
//
// Qué se empaqueta y qué no:
//   · el ÍNDICE (id, nombre, equipo, músculos) va en el bundle: 63 KB, 13 KB
//     comprimido, y permite buscar sin conexión;
//   · las IMÁGENES se piden a demanda y quedan en el caché del navegador. Son
//     ~38 KB cada una y son 873: empaquetarlas multiplicaría por diez el peso
//     de la app para mostrar un puñado.
//
// El índice está en inglés (la base es en inglés). Como la app y tus rutinas
// están en español, buscar "press banca" no encontraría "Barbell Bench Press":
// por eso hay una capa de sinónimos, abajo.
import RAW from './fedb-index.js';
import { norm } from './format.js';

const CDN = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** [id, nombre, equipo, músculos] → objeto, una sola vez. */
export const ILLUS = RAW.map(([id, name, equipment, muscles]) => ({
  id, name, equipment, muscles: muscles ? muscles.split('|') : [],
}));

/** URL de la primera imagen del ejercicio. */
export const illusUrl = id => `${CDN}/${encodeURI(id)}/0.jpg`;

// Español → inglés. Cubre el vocabulario de gimnasio que se usa acá; sin
// esto la búsqueda es inútil para alguien que escribe "jalón" o "sentadilla".
const ES_EN = {
  press: 'press', banca: 'bench', plano: 'bench', inclinado: 'incline',
  declinado: 'decline', militar: 'military shoulder', hombro: 'shoulder',
  hombros: 'shoulder', sentadilla: 'squat', sentadillas: 'squat',
  'peso muerto': 'deadlift', muerto: 'deadlift', remo: 'row',
  jalon: 'pulldown', jalón: 'pulldown', dominada: 'pull-up', dominadas: 'pull-up',
  curl: 'curl', bicep: 'biceps', biceps: 'biceps', bíceps: 'biceps',
  tricep: 'triceps', triceps: 'triceps', tríceps: 'triceps',
  extension: 'extension', extensión: 'extension', flexion: 'curl', flexión: 'curl',
  fondos: 'dip', fondo: 'dip', zancada: 'lunge', zancadas: 'lunge',
  estocada: 'lunge', pantorrilla: 'calf', gemelo: 'calf', gemelos: 'calf',
  abdominal: 'crunch', abdominales: 'crunch', abdomen: 'abdominals',
  plancha: 'plank', polea: 'cable', poleas: 'cable',
  mancuerna: 'dumbbell', mancuernas: 'dumbbell', barra: 'barbell',
  maquina: 'machine', máquina: 'machine', pecho: 'chest', pectoral: 'chest',
  espalda: 'back lats', dorsal: 'lats', dorsales: 'lats',
  pierna: 'leg', piernas: 'leg', gluteo: 'glutes', glúteo: 'glutes',
  gluteos: 'glutes', glúteos: 'glutes', cadera: 'hip',
  lateral: 'lateral', laterales: 'lateral raise', elevacion: 'raise',
  elevación: 'raise', elevaciones: 'raise', prensa: 'leg press',
  aductor: 'adductor', abductor: 'abductor', femoral: 'hamstring',
  isquio: 'hamstring', cuadriceps: 'quadriceps', cuádriceps: 'quadriceps',
  trapecio: 'traps', antebrazo: 'forearms', apertura: 'fly', aperturas: 'fly',
  cruce: 'crossover', encogimiento: 'shrug', encogimientos: 'shrug',
  pullover: 'pullover', hiperextension: 'hyperextension',
  hiperextensión: 'hyperextension', puente: 'bridge', empuje: 'thrust',
  unilateral: 'one arm single', frontal: 'front', trasero: 'rear',
  agarre: 'grip', ancho: 'wide', cerrado: 'close', neutro: 'neutral',
  sentado: 'seated', parado: 'standing', acostado: 'lying', inversa: 'reverse',
};

/** Traduce los términos en español de la consulta a sus equivalentes en inglés. */
function expand(query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const out = new Set(words);
  // frases de dos palabras primero ("peso muerto")
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (ES_EN[pair]) ES_EN[pair].split(' ').forEach(t => out.add(t));
  }
  for (const w of words) {
    // Plural: si la palabra no está en el mapa, se prueba en singular. Evita
    // tener que listar cada plural a mano ("pantorrillas" → "pantorrilla").
    const hit = ES_EN[w]
      || (w.endsWith('es') && ES_EN[w.slice(0, -2)])
      || (w.endsWith('s') && ES_EN[w.slice(0, -1)]);
    if (hit) hit.split(' ').forEach(t => out.add(t));
  }
  return [...out].filter(t => t.length > 1);
}

/**
 * Busca ilustraciones. Puntúa por cuántos términos de la consulta aparecen en
 * el nombre del ejercicio, y desempata favoreciendo nombres cortos — así
 * "press banca" trae "Barbell Bench Press" antes que una variante rebuscada.
 */
export function searchIllus(query, limit = 24) {
  const terms = expand(query);
  if (!terms.length) return [];
  const scored = [];
  for (const it of ILLUS) {
    const hay = norm(`${it.name} ${it.equipment} ${it.muscles.join(' ')}`);
    let hits = 0;
    for (const t of terms) if (hay.includes(t)) hits++;
    if (!hits) continue;
    scored.push({ it, hits, len: it.name.length });
  }
  scored.sort((a, b) => b.hits - a.hits || a.len - b.len);
  return scored.slice(0, limit).map(s => s.it);
}
