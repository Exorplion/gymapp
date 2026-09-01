// Puerto verbatim de web/src/lib/warmup.js. Task 2 portó
// tocaCalentar/bloqueDe/DESCANSO; Task 3 (WarmupCard.js) agrega
// RAMPA/warmupSets/MOVILIDAD, que es quien los consume.
import { round1 } from './format.js';
import { catOf } from './muscle.js';

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

/** A qué bloque pertenece cada grupo muscular.

    La única distinción que importa para calentar es superior/inferior: son
    zonas del cuerpo con una demanda articular y de riego totalmente distinta,
    así que terminar el bloque de arriba no deja nada "caliente" para el de
    abajo. Abs va con superior porque no es una zona de piernas — no necesita
    la movilidad de cadera que sí pide entrar a sentadilla o peso muerto. */
const BLOQUE_DE = {
  Pecho: 'superior', Espalda: 'superior', Hombro: 'superior',
  Bíceps: 'superior', Tríceps: 'superior', Abs: 'superior',
  Pierna: 'inferior', Glúteo: 'inferior', Gemelos: 'inferior',
};

/** El bloque (superior/inferior) de un ejercicio, o null si no se pudo
    clasificar — un ejercicio sin grupo reconocible no dispara nada, porque no
    hay manera honesta de saber qué articulación entra en juego. */
export function bloqueDe(ex) {
  return BLOQUE_DE[catOf(ex)] || null;
}

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

/** Movilidad dinámica antes de la rampa numérica, específica del bloque al
    que estás por entrar. La rampa calienta EL EJERCICIO —el patrón, el peso—
    pero no la articulación entera; unos minutos de movilidad son lo que
    tapa esa diferencia, sobre todo en el primer ejercicio de piernas del día.
    Nada de esto se registra: es preparación, no series. */
export const MOVILIDAD = {
  superior: ['Círculos de hombro, 10 hacia cada lado', 'Remo con banda floja o pull-apart, 15', 'Rotación de tronco suave, 10 por lado'],
  inferior: ['Sentadilla con el propio peso, 10', 'Zancadas caminando, 8 por pierna', 'Balanceo de cadera (leg swings), 10 por lado'],
};

/** ¿Corresponde ofrecer el calentamiento para ESTE ejercicio?

    Dos casos, no uno: el primero del día (nada calentado todavía) y cada vez
    que el bloque cambia respecto de lo ya calentado — típicamente al cruzar de
    tren superior a inferior o viceversa a mitad de sesión. Dentro del MISMO
    bloque no se repite: ya lo dijo el módulo, nadie hace una simple al 90%
    antes de las elevaciones laterales si ya venía de press militar. */
export function tocaCalentar(draft, ex) {
  if (!draft || !ex) return false;
  const bloque = bloqueDe(ex);
  if (!bloque) return false;
  const calentados = Array.isArray(draft.warmBlocks) ? draft.warmBlocks : [];
  return !calentados.includes(bloque);
}
