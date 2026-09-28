// Asistente "Agregar ejercicio" en 3 pasos (spec 2026-09-27 §1): la lógica,
// sin DOM ni React.
//
// Por qué existe: había dos flujos para lo mismo. En el editor de rutina,
// ExerciseForm + exercise-wizard.js (4 pasos, con un paso 2 de 1088 px y un
// paso "confirmar grupo" que siempre mostraba 10 chips). Con la sesión
// abierta, SessionExercise.jsx (una hoja de casi dos pantallas con un chip
// "Después de X" por cada ejercicio, también los ya hechos). Este módulo es
// el cerebro del único flujo que los reemplaza: ① qué ejercicio ② dónde va
// ③ cómo lo hacés. El componente (AgregarEjercicio.jsx) sólo pinta esto.
//
// Todo es puro y devuelve estados nuevos: se prueba sin montar nada
// (__tests__/asistente-agregar.test.js). La fuente de bugs real acá no es el
// markup, es "¿dónde quedó el ejercicio?".
import { catOf } from './muscle.js';
import { resolvedCat } from './exercise-wizard.js';
import { VENTANA } from './progression.js';

export const PASOS = 3;

/* Topes de los steppers. 10 series y 50 reps no son un límite fisiológico:
   son el borde donde un toque de más deja de ser un dato creíble. */
const TOPE = { sets: 10, reps: 50 };

/** `tipo`: 'rutina' (guarda en el turno) o 'sesion' (sólo hoy, en el
    borrador). `posicion` null = la sugerida; un número = la que eligió la
    persona, como índice de inserción en la lista del paso 2. */
export function estadoInicial(tipo = 'rutina') {
  return {
    tipo, paso: 1, posicion: null,
    form: { name: '', cat: '', sets: 3, reps: 10, equip: '', unilateral: false },
  };
}

const detectado = name => catOf({ name }) || null;

/** ¿Hay que preguntar el grupo? Sólo si hay nombre y la detección de siempre
    (catOf, la misma que usa todo el resto de la app) no lo reconoce. Ya no
    existe el paso "confirmar grupo": si se detectó, no se pregunta. */
export const necesitaGrupo = form => !!form.name.trim() && !detectado(form.name);

/** El grupo del ejercicio: el elegido a mano o el detectado (resolvedCat,
    exercise-wizard.js). null si todavía no hay ninguno: nunca se inventa. */
export const grupoDe = form => resolvedCat(form) || null;

/** Cambiar el nombre descarta un grupo elegido a mano si el nombre nuevo se
    detecta solo: ese grupo se eligió porque el nombre anterior NO se
    reconocía, y dejarlo pisaría la detección (resolvedCat le da prioridad a
    lo manual). También vuelve a la posición sugerida, que depende del grupo. */
export function setNombre(estado, name) {
  const cat = detectado(name) ? '' : estado.form.cat;
  return { ...estado, form: { ...estado.form, name, cat }, posicion: null };
}

export function setGrupo(estado, cat) {
  return { ...estado, form: { ...estado.form, cat }, posicion: null };
}

export function setCampo(estado, campo, valor) {
  return { ...estado, form: { ...estado.form, [campo]: valor } };
}

/** El stepper de series o reps: suma `delta` y recorta a [1, tope]. */
export function ajustar(estado, campo, delta) {
  const v = (parseInt(estado.form[campo], 10) || 1) + delta;
  return setCampo(estado, campo, Math.min(TOPE[campo], Math.max(1, v)));
}

/** Qué falta para avanzar, en texto para mostrar — o null. Sólo el paso 1
    bloquea: los pasos 2 y 3 siempre tienen un valor válido (la posición
    sugerida y los defaults de los steppers). */
export function validarPaso(estado) {
  if (estado.paso !== 1) return null;
  if (!estado.form.name.trim()) return 'Escribí o elegí un ejercicio para seguir';
  if (!grupoDe(estado.form)) return 'Elegí qué grupo entrena para seguir';
  return null;
}

export function avanzar(estado) {
  const error = validarPaso(estado);
  if (error) return { estado, error };
  return { estado: { ...estado, paso: Math.min(PASOS, estado.paso + 1) }, error: null };
}

/** "‹": retrocede sin borrar nada de lo cargado. */
export const volver = estado => ({ ...estado, paso: Math.max(1, estado.paso - 1) });

/** El rango que muestra el stepper de reps. No es uno nuevo: es el de la
    doble progresión (progression.ts), piso = `reps` y tope = piso + VENTANA,
    el que la app de verdad usa para decidir cuándo subir el peso. */
export function rangoReps(reps) {
  const piso = Math.max(1, parseInt(reps, 10) || 1);
  return { piso, tope: piso + VENTANA, texto: `${piso}–${piso + VENTANA}` };
}

export const textoCTA = tipo => (tipo === 'sesion' ? 'Agregar a la sesión' : 'Agregar a la rutina');

/** Lo que se guarda. `cat` sólo si se eligió a mano: vacío es "automático"
    (catOf) para saveExercise y para el resto de la app, así un nombre
    reconocido nunca queda atado a un grupo fijo. */
export function datosParaGuardar(form) {
  const name = form.name.trim();
  return {
    name, sets: form.sets, reps: form.reps, equip: form.equip || '',
    unilateral: !!form.unilateral, cat: detectado(name) ? '' : (form.cat || ''),
  };
}
