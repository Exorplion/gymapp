// Qué toca HOY en un ejercicio, en una forma corta para mostrar: el panel
// "Hoy" de la tarjeta y la columna derecha del plan en la pantalla Hoy.
//
// No inventa: la fuente es la doble progresión (progression.ts) sobre tu
// última sesión, y si no hay historial, el sugerido por 1RM estimado
// (charts.js). Sin ninguno de los dos, dice "primera vez" — nunca un número.
import { progresion } from './progression.js';
import { suggestedWeight } from './charts.js';
import { round1 } from './format.js';
import { wToUnit } from './state.js';
import { pesoTraido, unidadDe, enLaMaquina, alEscalon } from './unidades.js';

/**
 * @param {object} ex             el ejercicio
 * @param {{ uni?: boolean, ajuste?: number }} [opts]
 *   uni: unilateral (el 1RM se guarda aparte, ver ExerciseCarousel)
 *   ajuste: el ±% del chequeo de "Antes de empezar" (S.draft.precheckAdjust)
 * @returns {{
 *   tipo: 'subir'|'sostener'|'sumar'|'traido'|'sugerido'|'primera',
 *   peso: number|null, antes: number|null, meta: number|null, texto: string
 * }}
 */
export function objetivoHoy(ex, { uni = false, ajuste = 0 } = {}) {
  /* El peso de hoy, en un número que esta máquina tiene (enLaMaquina): la
     tarjeta, el plan y la rueda dicen lo mismo. `antes` queda tal cual: es lo
     que pasó, y se muestra en la unidad en que pasó (unidadUltima). */
  const u = unidadDe(ex);
  const p = uni ? null : progresion(ex);
  if (p) {
    if (p.accion === 'subir_peso') {
      const peso = enLaMaquina(p.peso, u);
      const salto = round1(wToUnit(peso, u) - wToUnit(enLaMaquina(p.pesoAnterior, u), u));
      return {
        tipo: 'subir', peso, antes: p.pesoAnterior, meta: p.piso,
        texto: `subí ${salto} ${u} · volvé a ${p.piso}`,
      };
    }
    const faltan = p.seriesTotales - p.seriesEnTope;
    return {
      tipo: p.accion === 'sostener' ? 'sostener' : 'sumar',
      peso: enLaMaquina(p.peso, u), antes: p.pesoAnterior, meta: p.tope,
      texto: p.accion === 'sostener'
        ? `${faltan} serie${faltan === 1 ? '' : 's'} más a ${p.tope} reps`
        : `sumá reps · meta ${p.tope}`,
    };
  }
  /* Primera vez en esta máquina, pero hecho en otra (otro gym): el peso de
     allá, tal cual, para probarlo (unidades.js). Gana al sugerido por 1RM
     porque es un número que levantaste de verdad, no una cuenta. */
  const traido = pesoTraido(uni ? { ...ex, unilateral: true } : ex);
  if (traido) {
    // al escalón de ESTA máquina: 80 kg en una que marca lb son 175
    return { tipo: 'traido', peso: alEscalon(traido.kg, u), antes: null, meta: null, origen: traido.origen, enOtroGym: traido.enOtroGym, unidad: traido.unidad, reps: traido.r, texto: `de ${traido.origen}` };
  }
  const base = suggestedWeight(uni ? `${ex.name} (unilateral)` : ex.name);
  if (base) {
    return {
      tipo: 'sugerido', peso: enLaMaquina(round1(base * (1 + ajuste)), u), antes: null, meta: null,
      texto: `80% de tu 1RM estimado${ajuste ? ` · ${ajuste > 0 ? '+' : ''}${Math.round(ajuste * 100)}% por tu chequeo` : ''}`,
    };
  }
  return { tipo: 'primera', peso: null, antes: null, meta: null, texto: 'arrancá liviano' };
}

/** Resumen del plan: cuántos ejercicios tocan subir de peso y cuántos
    superar reps. Los de "primera vez" y "sugerido" no cuentan en ninguno: no
    hay una marca anterior que superar. */
export function resumenPlan(exs) {
  let subir = 0, superar = 0;
  for (const ex of exs || []) {
    const o = objetivoHoy(ex);
    if (o.tipo === 'subir') subir++;
    else if (o.tipo === 'sostener' || o.tipo === 'sumar') superar++;
  }
  return { subir, superar };
}
