// Máquina de estados PURA del onboarding de "Nuevo ejercicio" (4 pasos:
// nombre -> cómo se hace -> confirmar -> agregado). Vive separada de
// ExerciseForm.jsx a propósito: son funciones sin DOM ni React, así que se
// pueden testear directo (ver exercise-wizard.test.js) sin montar el sheet
// completo — la fuente de bugs real acá es "¿a qué paso vuelvo?" y "¿qué se
// borra al agregar otro?", no el markup.
//
// No pisa saveExercise() (rutina-logic.js): esto sólo decide en qué paso
// está el formulario y qué trae cada paso nuevo. Guardar de verdad lo sigue
// haciendo saveExercise, desde ExerciseForm.jsx.
import { catOf } from './muscle.js';

export const TOTAL_PASOS = 4;

/** Campos del formulario en blanco — el punto de partida de un ejercicio
    nuevo, y a lo que vuelve "Agregar otro" entre una vuelta y la siguiente. */
export function emptyForm() {
  return {
    name: '', sets: 4, reps: 10, equip: '', cat: '', machine: '',
    unilateral: false, photo: '', illus: '',
    // Peso de partida: texto, en la unidad que ve el usuario, y vacío por
    // defecto. Vacío es "sin declarar" — no es 0, y no bloquea el alta.
    pesoInicial: '',
  };
}

/** Estado completo del wizard. `batch` es la lista de nombres agregados en
    esta tanda (se pierde al cerrar el sheet — ver CLAUDE.md/consigna: es un
    recuento de la tanda, no un dato persistente). */
export function initialWizardState() {
  return { step: 1, form: emptyForm(), batch: [] };
}

/** Grupo muscular a mostrar en el paso 3: el elegido a mano gana siempre
    sobre el detectado — nunca se pisa una elección manual con el automático. */
export function resolvedCat(form) {
  return form.cat || catOf({ name: form.name }) || '';
}

/** Qué falta para avanzar del paso actual, en texto para mostrar (no un
    "error" genérico) — o null si puede avanzar. Sólo el paso 1 bloquea: sin
    nombre no hay nada que agrupar ni confirmar después. */
export function validateStep(state) {
  if (state.step === 1 && !state.form.name.trim()) {
    return 'Ponele un nombre al ejercicio para seguir';
  }
  return null;
}

/** Avanza un paso si la validación lo permite. Devuelve el mismo estado
    (sin avanzar) más el mensaje si falta algo — así el llamador decide cómo
    mostrarlo (toast, texto inline) sin que esta función sepa de UI. */
export function nextStep(state) {
  const error = validateStep(state);
  if (error) return { state, error };
  return { state: { ...state, step: Math.min(TOTAL_PASOS, state.step + 1) }, error: null };
}

/** Retrocede sin perder nada de lo cargado — los campos viven en `form` y no
    se tocan acá. */
export function prevStep(state) {
  return { ...state, step: Math.max(1, state.step - 1) };
}

/** Cambia un campo del formulario en el paso en curso. */
export function setField(state, field, value) {
  return { ...state, form: { ...state.form, [field]: value } };
}

/** Se acaba de guardar el ejercicio (afuera, con saveExercise): lo suma a la
    tanda y pasa al paso 4 ("Agregado"). `name` se pasa aparte del form
    porque para cuando esto corre el form ya pudo haberse limpiado. */
export function confirmAdded(state, name) {
  return { ...state, step: TOTAL_PASOS, batch: [...state.batch, name] };
}

/** "Agregar otro": vuelve al paso 1 con el formulario en blanco, sin tocar
    la tanda acumulada ni cerrar el sheet — es lo que hace el flujo continuo. */
export function startAnother(state) {
  return { ...state, step: 1, form: emptyForm() };
}
