// Doble progresión: la regla que decide, hoy, si te toca sumar repeticiones o
// sumar peso.
//
// El problema que resuelve: la app ya te dice "sugerido ~62.5 kg (80% de tu
// 1RM estimado)", que es un número correcto y **no una instrucción**. Un 1RM
// estimado no sabe qué hiciste la semana pasada, así que no puede decirte si
// hoy te toca avanzar o sostener. La decisión terminaba siendo tuya, en el
// gimnasio, cada vez — que es exactamente el tipo de peaje que este roadmap
// viene sacando del medio.
//
// La regla es vieja y es la que casi todo programa de fuerza usa: elegís un
// RANGO de repeticiones; te quedás en el mismo peso hasta que llegás al tope
// del rango en TODAS las series; recién ahí subís el peso y volvés al piso
// del rango. Progresás en dos ejes alternados, de ahí el nombre. Es más
// segura que subir peso por calendario porque el permiso para subir lo da tu
// propio rendimiento, no la fecha.
//
// El rango sale del objetivo que ya tiene cada ejercicio en la rutina
// (`ex.reps`): ese número es el PISO y el tope es piso + VENTANA. No se
// inventa un rango nuevo ni se le pide al usuario que configure otra cosa.
import { S } from './state.js';
import { exKey } from './equip.js';
import { round1 } from './format.js';

/** Cuántas repeticiones de margen tiene el rango por encima del objetivo.
    Tres es la ventana clásica (8-11, 10-13): suficiente para que subir el
    peso no sea cada semana, corta para que no te quedes meses en el mismo
    peso haciendo series eternas. Convención declarada, no un dato medido. */
export const VENTANA = 3;

/** Cuánto sube el peso cuando el rango se completa, como fracción. 2.5% es
    un salto que casi siempre se puede sostener; se redondea después al
    incremento real que permita el equipo. */
const SALTO = 0.025;

interface Serie { w: number; r: number }
interface Entrada { name: string; equip?: string; machine?: string; sets: Serie[] }
interface Sesion { date: string; entries?: Entrada[] }

export interface ExLike { name: string; reps?: number; sets?: number; equip?: string; machine?: string }

export type Accion = 'subir_peso' | 'sumar_reps' | 'sostener';

export interface Progresion {
  accion: Accion;
  /** Piso y tope del rango de repeticiones de este ejercicio. */
  piso: number;
  tope: number;
  /** El peso con el que se entrenó la última vez (el de la serie más pesada). */
  pesoAnterior: number;
  /** El peso que corresponde HOY. Igual al anterior salvo que toque subir. */
  peso: number;
  /** Cuántas series de la última sesión llegaron al tope del rango. */
  seriesEnTope: number;
  seriesTotales: number;
}

/** La última sesión en la que se hizo este ejercicio, con sus series.
    Se busca por `exKey` (nombre + equipo + máquina), igual que el resto de la
    app: el mismo movimiento en otra máquina es otro historial. */
function ultimaVez(ex: ExLike): Serie[] | null {
  const key = exKey(ex);
  for (const s of S.sessions as Sesion[]) {
    const e = (s.entries || []).find(en => exKey(en) === key);
    if (e && e.sets.length) return e.sets;
  }
  return null;
}

/** Qué toca hoy en este ejercicio, o `null` si todavía no hay con qué
    decidirlo.

    `null` cuando no hay historial (la primera vez no se progresa contra nada)
    o cuando el ejercicio no tiene un objetivo de repeticiones: sin rango la
    regla no existe. Como en el resto de la app, se prefiere no decir nada a
    decir algo sin base.

    Se mira SÓLO la última sesión, no un promedio: la doble progresión es una
    regla sobre el último intento — "¿lo lograste o no?"— y promediar
    convertiría un logro en un "casi". */
export function progresion(ex: ExLike): Progresion | null {
  const piso = Math.round(Number(ex?.reps) || 0);
  if (!(piso > 0)) return null;
  const sets = ultimaVez(ex);
  if (!sets?.length) return null;

  const tope = piso + VENTANA;
  const pesoAnterior = Math.max(...sets.map(s => s.w));
  /* Sólo cuentan las series hechas AL PESO MÁS ALTO de esa sesión. Una serie
     de aproximación liviana que llegó al tope del rango no es evidencia de
     que el peso de trabajo esté dominado, y contarla adelantaría la subida:
     el error clásico de esta regla implementada de apuro. */
  const trabajo = sets.filter(s => s.w >= pesoAnterior - 0.01);
  const seriesEnTope = trabajo.filter(s => s.r >= tope).length;
  const objetivo = Math.max(1, Math.round(Number(ex?.sets) || trabajo.length));

  /* Para subir el peso hay que haber llegado al tope en todas las series
     PLANIFICADAS, no sólo en las que se hicieron: cortar la sesión a la mitad
     y llegar al tope en las dos primeras no es haber dominado el peso. */
  if (seriesEnTope >= objetivo && trabajo.length >= objetivo) {
    return {
      accion: 'subir_peso', piso, tope, pesoAnterior,
      peso: round1(pesoAnterior * (1 + SALTO)),
      seriesEnTope, seriesTotales: trabajo.length,
    };
  }
  return {
    accion: seriesEnTope > 0 ? 'sostener' : 'sumar_reps',
    piso, tope, pesoAnterior, peso: pesoAnterior,
    seriesEnTope, seriesTotales: trabajo.length,
  };
}

/** La instrucción en una línea, lista para mostrar. Vive acá y no en el .jsx
    para que la regla y la frase que la explica no se puedan separar. */
export function progresionTexto(p: Progresion): string {
  if (p.accion === 'subir_peso') {
    return `Llegaste a ${p.tope} reps en las ${p.seriesEnTope} series: subí a ${p.peso} kg y volvé a ${p.piso}.`;
  }
  if (p.accion === 'sostener') {
    return `Quedate en ${p.peso} kg: te faltan ${p.seriesTotales - p.seriesEnTope} de ${p.seriesTotales} series para llegar a ${p.tope} reps.`;
  }
  return `Quedate en ${p.peso} kg y sumá reps: el objetivo es llegar a ${p.tope} en las ${p.seriesTotales} series.`;
}
