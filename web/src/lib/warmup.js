// El calentamiento antes de la primera serie del día.
//
// Tres series que suben hacia tu peso de trabajo, seguidas y sin descanso entre
// ellas, y recién después el descanso largo. La idea es llegar a la primera
// serie real con el patrón ya ensayado y el músculo caliente, sin haber gastado
// nada: 5+3+1 son nueve repeticiones en total, y sólo la última se acerca al
// peso de verdad.
//
// Va una vez por sesión y sobre el PRIMER ejercicio del día. No tiene sentido
// repetirlo en cada accesorio —nadie hace una simple al 90% antes de las
// elevaciones laterales—, y el primer ejercicio de un día bien ordenado es el
// básico pesado, que es justo el que lo necesita.
//
// Las series de calentamiento NO se registran: no suman volumen, no cuentan
// para las series objetivo y no compiten por récords. Son preparación, no
// entrenamiento, y contarlas ensuciaría todos los números de Progreso.
import { round1 } from './format.js';

/** La rampa: porcentaje del peso de trabajo y repeticiones. */
export const RAMPA = [
  { pct: 0.50, reps: 5 },
  { pct: 0.75, reps: 3 },
  { pct: 0.90, reps: 1 },
];

/** Descanso después de la rampa, en segundos.

    Enzo lo pidió como "dos y medio o tres minutos". 165 s es el punto medio, y
    a esta altura la diferencia entre 150 y 180 no cambia nada. */
export const DESCANSO = 165;

/**
 * Los pesos del calentamiento para un peso de trabajo dado.
 *
 * `paso` es el incremento más chico que podés cargar de verdad (2.5 kg con
 * discos, otra cosa con mancuernas). Redondear a ese paso importa: un
 * calentamiento que dice 46.25 kg no se puede armar, y te deja resolviendo
 * aritmética en vez de levantando.
 *
 * Devuelve [] si no hay un peso de trabajo con el que calcular: sin eso los
 * porcentajes no significan nada, y mostrar tres ceros sería peor que no
 * mostrar nada.
 */
export function warmupSets(topKg, paso = 2.5) {
  const top = Number(topKg);
  if (!(top > 0) || !(paso > 0)) return [];
  return RAMPA.map(({ pct, reps }) => {
    // nunca por debajo de un paso: el redondeo de un peso liviano puede dar 0,
    // y "calentá con 0 kg" no es una instrucción
    const w = Math.max(paso, Math.round((top * pct) / paso) * paso);
    return { pct, reps, w: round1(w) };
  });
}

/** ¿Corresponde ofrecer el calentamiento?

    Sólo al principio: con una serie ya registrada el momento pasó, y la tarjeta
    pasaría de recordatorio a estorbo. */
export function tocaCalentar(draft, primerExId) {
  if (!draft || !primerExId) return false;
  if (draft.warmDone) return false;
  const entries = Object.values(draft.entries || {});
  return !entries.some(e => e.sets?.length);
}
