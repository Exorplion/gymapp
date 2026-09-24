// El calentamiento antes de la primera serie de cada BLOQUE muscular del día.
//
// Tres series que suben hacia tu peso de trabajo, seguidas y sin descanso entre
// ellas, y recién después el descanso largo. La idea es llegar a la primera
// serie real con el patrón ya ensayado y el músculo caliente, sin haber gastado
// nada: 5+3+1 son nueve repeticiones en total, y sólo la última se acerca al
// peso de verdad.
//
// No va una vez por sesión: va una vez por BLOQUE (tren superior / tren
// inferior). Un empuje-tirón-pierna típico cruza de superior a inferior a
// mitad de sesión, y entrar en frío a la sentadilla porque ya "calentaste"
// con el press de una hora antes es la superficie donde más se lesiona la
// gente. No repite en cada accesorio del MISMO bloque —nadie hace una simple
// al 90% antes de las elevaciones laterales si ya hizo press militar—, sólo
// cuando el bloque cambia.
//
// Las series de calentamiento NO se registran: no suman volumen, no cuentan
// para las series objetivo y no compiten por récords. Son preparación, no
// entrenamiento, y contarlas ensuciaría todos los números de Progreso.
import { round1 } from './format.js';
import { catOf, type ExLike } from './muscle.js';

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

export interface WarmupSet { pct: number; reps: number; w: number; }

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
export function warmupSets(topKg: number | string, paso = 2.5): WarmupSet[] {
  const top = Number(topKg);
  if (!(top > 0) || !(paso > 0)) return [];
  return RAMPA.map(({ pct, reps }) => {
    // nunca por debajo de un paso: el redondeo de un peso liviano puede dar 0,
    // y "calentá con 0 kg" no es una instrucción
    const w = Math.max(paso, Math.round((top * pct) / paso) * paso);
    return { pct, reps, w: round1(w) };
  });
}

/** A qué bloque pertenece cada grupo muscular.

    La única distinción que importa para calentar es superior/inferior: son
    zonas del cuerpo con una demanda articular y de riego totalmente distinta,
    así que terminar el bloque de arriba no deja nada "caliente" para el de
    abajo. Abs va con superior porque no es una zona de piernas — no necesita
    la movilidad de cadera que sí pide entrar a sentadilla o peso muerto. */
const BLOQUE_DE: Record<string, 'superior' | 'inferior'> = {
  Pecho: 'superior', Espalda: 'superior', Hombro: 'superior',
  Bíceps: 'superior', Tríceps: 'superior', Abs: 'superior',
  Pierna: 'inferior', Glúteo: 'inferior', Gemelos: 'inferior',
  // Lumbares va con inferior: back extension y good morning son bisagra de
  // cadera, la misma demanda articular que el peso muerto.
  Lumbares: 'inferior',
};

/** El bloque (superior/inferior) de un ejercicio, o null si no se pudo
    clasificar — un ejercicio sin grupo reconocible no dispara nada, porque no
    hay manera honesta de saber qué articulación entra en juego. */
export function bloqueDe(ex: ExLike | string | null | undefined): 'superior' | 'inferior' | null {
  const cat = catOf(ex);
  return (cat && BLOQUE_DE[cat]) || null;
}

/** El calentamiento GENERAL, el que va una sola vez al abrir la sesión y
    antes de cualquier máquina (hoja 'calentamiento', 2026-09-24).

    Es lo que Enzo ya hacía por su cuenta — rotaciones interna y externa y
    face pulls para el manguito rotador — y pidió tenerlo en la app: dos
    ejercicios como máximo, bien hechos. En días que arrancan con pierna el
    manguito no tiene nada que hacer y se cambia por cadera y tobillo.

    Reemplaza a la lista de movilidad de tres ítems que mostraba la tarjeta de
    calentamiento: la rampa (RAMPA, más arriba) sigue siendo por ejercicio y
    vive ahora adentro de la tarjeta del ejercicio. Nada de esto se registra:
    es preparación, no series. */
export interface EjercicioCalentamiento { nombre: string; dosis: string; como: string; }
export const CALENTAMIENTO_GENERAL: Record<'superior' | 'inferior', { foco: string; ejercicios: EjercicioCalentamiento[] }> = {
  superior: {
    foco: 'Manguito rotador',
    ejercicios: [
      { nombre: 'Rotación externa e interna con banda', dosis: '2 × 12 c/u por brazo', como: 'Codo pegado al cuerpo a 90°. Girá lento: 2 s de ida y 2 s de vuelta.' },
      { nombre: 'Face pull liviano', dosis: '2 × 15', como: 'Tirá hacia la frente con los codos altos. Pausa de 1 s atrás.' },
    ],
  },
  inferior: {
    foco: 'Cadera y tobillo',
    ejercicios: [
      { nombre: 'Puente de glúteo', dosis: '2 × 12', como: 'Apretá los glúteos 1 s arriba, sin arquear la zona lumbar.' },
      { nombre: 'Movilidad de tobillo y cadera', dosis: '10 por lado', como: 'Rodilla hacia adelante sobre la punta del pie con el talón apoyado; después balanceo de pierna.' },
    ],
  },
};

/** Qué calentamiento general corresponde: el del bloque del PRIMER ejercicio
    que se va a hacer — es a esa articulación a la que vas a entrar en frío.
    Sin ninguno clasificable, el de tren superior (el más común). */
export function calentamientoGeneral(exs: (ExLike | string)[] | null | undefined) {
  const primero = (exs || []).map(bloqueDe).find(Boolean) || 'superior';
  return CALENTAMIENTO_GENERAL[primero];
}

interface Draft { warmBlocks?: string[]; }

/** ¿Corresponde ofrecer el calentamiento para ESTE ejercicio?

    Dos casos, no uno: el primero del día (nada calentado todavía) y cada vez
    que el bloque cambia respecto de lo ya calentado — típicamente al cruzar de
    tren superior a inferior o viceversa a mitad de sesión. Dentro del MISMO
    bloque no se repite: ya lo dijo el módulo, nadie hace una simple al 90%
    antes de las elevaciones laterales si ya venía de press militar. */
export function tocaCalentar(draft: Draft | null | undefined, ex: ExLike | string | null | undefined): boolean {
  if (!draft || !ex) return false;
  const bloque = bloqueDe(ex);
  if (!bloque) return false;
  const calentados = Array.isArray(draft.warmBlocks) ? draft.warmBlocks : [];
  return !calentados.includes(bloque);
}
