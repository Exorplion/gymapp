// Lo que quedó del onboarding de "Nuevo ejercicio" de 4 pasos (el
// CreateWizard de ExerciseForm, retirado el 2026-09-28). El alta ahora es el
// asistente de 3 pasos (lib/asistente-agregar.js + AgregarEjercicio.jsx);
// de acá sólo sobrevive la regla del grupo muscular, que el asistente usa
// tal cual.
import { catOf } from './muscle.js';

/** Grupo muscular del ejercicio: el elegido a mano gana siempre sobre el
    detectado — nunca se pisa una elección manual con el automático. Vacío
    si no hay ninguno: no se inventa. */
export function resolvedCat(form) {
  return form.cat || catOf({ name: form.name }) || '';
}
