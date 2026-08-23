// Puerto verbatim de web/src/lib/warmup.js — sólo lo que Task 2 del plan
// pide: tocaCalentar, bloqueDe, DESCANSO. RAMPA/warmupSets/MOVILIDAD quedan
// para cuando se porte WarmupCard.js (Task 3), que es quien los consume.
import { catOf } from './muscle.js';

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
