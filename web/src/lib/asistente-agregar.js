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
import { S, openSheet } from './state.js';
import { EXCATALOG, MUSCLE_CATS, catOf, porBloques } from './muscle.js';
import { norm } from './format.js';
import { exMatchesQuery } from './exdb.js';
import { resolvedCat } from './exercise-wizard.js';
import { VENTANA } from './progression.js';
import { dayCategories, saveExercise } from './rutina-logic.js';
import { sessionExs, isSkipped, setsDone, targetSets, addSessionExercise } from './session.js';

export const PASOS = 3;

/* Cada apertura lleva un número propio: App.jsx lo usa de `key`, así
   "Agregar otro" (el toast) monta un asistente NUEVO en el paso 1 aunque la
   hoja anterior todavía esté terminando de cerrarse — con la misma key React
   reusaría el componente viejo, parado en el paso 3. */
let vez = 0;

/** La única puerta de entrada: rutina (Entreno → turno, Plan de hoy) y
    sesión (··· → Agregar ejercicio). `wd` es el índice del turno. */
export function abrirAsistente(wd, tipo = 'rutina') {
  openSheet('agregar-ej', { wd: +wd, tipo, vez: ++vez });
}

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

/* ---------- paso 1: sugerencias ----------
   `ctx` (lo arman contextoRutina / contextoSesion, más abajo) es
   { tipo, nombreTurno, fijos: Fila[], movibles: Fila[] } con
   Fila = { id, name, cat?, sets, estado: 'pendiente'|'en-curso'|'hecho'|'salteado' }. */

/** Autocompletado del catálogo mientras se escribe (la misma búsqueda por
    nombre y palabras clave que ya usaba ExerciseForm). Lo ya escrito entero
    no se repite como sugerencia. */
export function autocompletar(q, max = 6) {
  const nq = norm(q);
  if (!nq) return [];
  return EXCATALOG.filter(e => norm(e.n) !== nq && exMatchesQuery(e.n, nq)).slice(0, max).map(e => e.n);
}

/** "Explorar": el catálogo de un grupo, sin lo que ya está en el turno. */
export function catalogoDe(cat, yaEstan = []) {
  const ya = new Set(yaEstan.map(n => norm(n)));
  return EXCATALOG.filter(e => e.c === cat && !ya.has(norm(e.n))).map(e => e.n);
}

/** "Te falta hoy · <grupo>": el grupo menos trabajado del turno, con
    ejercicios del catálogo que todavía no están.

    Menos trabajado = menos series PLANIFICADAS en el turno. Los candidatos
    son los grupos que el turno ya tiene más los que su nombre promete
    ("Pecho / Tríceps", dayCategories): un grupo prometido sin ejercicios
    vale 0, que es justamente lo que falta. Lo salteado no cuenta: no se
    trabaja. Antes las sugerencias salían SÓLO del nombre del turno, y en
    "Anterior A" (que no nombra ningún grupo) ofrecían dominadas en un día de
    empuje (relevamiento, fricción A.3).

    null si no hay ningún candidato: la fila no se muestra, no se inventa. */
export function teFaltaHoy(ctx, max = 3) {
  const filas = [...ctx.fijos, ...ctx.movibles].filter(x => x.estado !== 'salteado');
  const series = new Map();
  for (const c of dayCategories(ctx.nombreTurno)) series.set(c, 0);
  for (const x of filas) {
    const c = catOf(x);
    if (c) series.set(c, (series.get(c) || 0) + (x.sets || 0));
  }
  const nombres = filas.map(x => x.name);
  const orden = [...series.entries()]
    .sort((a, b) => a[1] - b[1] || MUSCLE_CATS.indexOf(a[0]) - MUSCLE_CATS.indexOf(b[0]));
  for (const [cat] of orden) {
    const ejercicios = catalogoDe(cat, nombres).slice(0, max);
    if (ejercicios.length) return { cat, ejercicios };
  }
  return null;
}

/* ---------- paso 2: dónde va ---------- */

/** El id de la fila nueva en la lista del paso 2 (va en `data-sid`, así el
    arrastre de drag.js la reconoce). No choca con uid(): lleva guiones bajos. */
export const NUEVO = '__nuevo';

const fila = (e, estado = 'pendiente') => ({ id: e.id, name: e.name, cat: e.cat, sets: e.sets, estado });
const grupoFila = x => catOf(x) || 'Otros';
const minus = cat => (cat ? cat.toLowerCase() : null);

/** Rutina: la lista es porBloques(), el orden que SE VE y, desde #124, el
    real (el editor guarda así y la sesión arranca así). Nada es fijo. */
export function contextoRutina(index) {
  const d = S.routine[index];
  return {
    tipo: 'rutina', nombreTurno: d?.name || '', fijos: [],
    movibles: porBloques(d?.exercises || []).map(e => fila(e)),
  };
}

/* Un ejercicio con series registradas ya empezó: meter el nuevo delante
   sería reescribir lo que ya pasó. Lo salteado tampoco se mueve (saltar no
   toca el orden, ver skipExercise). */
function estadoEnSesion(e) {
  if (isSkipped(e.id)) return 'salteado';
  const hechas = setsDone(e.id).length;
  if (!hechas) return 'pendiente';
  return hechas >= targetSets(e) ? 'hecho' : 'en-curso';
}

/** Sesión: el orden real del borrador (sessionExs, que NO reagrupa: con la
    sesión abierta el orden es libre). Lo hecho, empezado o salteado va
    arriba, apagado y fijo; el nuevo sólo se mueve entre los pendientes. Es
    lo que Despues.jsx ya hacía bien y SessionExercise no (le ofrecía
    "Después de X" también por los ya hechos). */
export function contextoSesion(index) {
  const filas = sessionExs(index).map(e => fila(e, estadoEnSesion(e)));
  return {
    tipo: 'sesion',
    nombreTurno: S.routine[index]?.name || S.draft?.dayName || '',
    fijos: filas.filter(x => x.estado !== 'pendiente'),
    movibles: filas.filter(x => x.estado === 'pendiente'),
  };
}

/** Dónde se puede soltar el nuevo: índices de inserción en ctx.movibles.

    En la sesión, en cualquier lado. En la rutina NO: el editor pinta por
    bloques (porBloques), así que un ejercicio de Espalda soltado entre dos
    de Pecho se reagruparía solo y NO quedaría donde se lo dejó. Vale sólo
    donde se queda: dentro de su bloque (bordes incluidos) si el grupo ya
    está, o en un borde entre bloques si es un grupo nuevo. */
export function posicionesValidas(ctx, cat) {
  const m = ctx.movibles, n = m.length;
  const todas = Array.from({ length: n + 1 }, (_, i) => i);
  if (ctx.tipo !== 'rutina') return todas;
  const g = cat || 'Otros';
  const suyos = m.map((x, i) => (grupoFila(x) === g ? i : -1)).filter(i => i >= 0);
  if (suyos.length) return todas.slice(suyos[0], suyos[suyos.length - 1] + 2);
  return todas.filter(i => i === 0 || i === n || grupoFila(m[i - 1]) !== grupoFila(m[i]));
}

/** El lugar sugerido y la línea que lo explica: después del último de su
    grupo; en la sesión, si su grupo sólo está en lo ya hecho, el próximo
    (para seguir con ese grupo); si no hay otro de su grupo, al final. */
export function posicionSugerida(ctx, cat) {
  const { movibles: m, fijos, tipo } = ctx;
  const g = minus(cat);
  const suyos = cat ? m.filter(x => catOf(x) === cat) : [];
  if (suyos.length) {
    const ultimo = suyos[suyos.length - 1];
    const con = suyos.length === 1 ? `el otro de ${g}` : `los otros de ${g}`;
    return { pos: m.indexOf(ultimo) + 1, texto: `Sugerido: con ${con}, después de ${ultimo.name}.` };
  }
  if (cat && tipo === 'sesion' && m.length && fijos.some(x => catOf(x) === cat)) {
    return { pos: 0, texto: `Sugerido: el próximo, para seguir con ${g}.` };
  }
  if (!m.length) {
    if (tipo !== 'sesion') return { pos: 0, texto: 'Es el primero del turno.' };
    return { pos: 0, texto: fijos.length ? 'Va después de lo que ya hiciste.' : 'Es el primero de la sesión.' };
  }
  return { pos: m.length, texto: g ? `Sugerido: al final. Hoy no hay otro de ${g}.` : 'Sugerido: al final.' };
}

const masCercana = (validas, pos) =>
  validas.reduce((mejor, v) => (Math.abs(v - pos) < Math.abs(mejor - pos) ? v : mejor), validas[0]);

/** La posición en uso: la elegida o la sugerida, siempre una válida. */
export function posicionDe(estado, ctx) {
  const cat = grupoDe(estado.form);
  const pos = estado.posicion ?? posicionSugerida(ctx, cat).pos;
  return masCercana(posicionesValidas(ctx, cat), pos);
}

/** ▲▼, la alternativa accesible al arrastre: salta a la posición válida
    vecina. En el borde devuelve el MISMO estado (el botón va deshabilitado). */
export function moverNuevo(estado, ctx, dir) {
  const validas = posicionesValidas(ctx, grupoDe(estado.form));
  const i = validas.indexOf(posicionDe(estado, ctx)) + dir;
  if (i < 0 || i >= validas.length) return estado;
  return { ...estado, posicion: validas[i] };
}

/** El commit del arrastre (drag.js). Recibe el orden de ids que quedó en la
    caja arrastrable, con NUEVO adentro. Se ancla a los VECINOS y no al
    índice, así funciona igual con la lista recortada ("+N más"). Si lo
    soltaron donde no se quedaría (rutina), va al lugar válido más cercano. */
export function soltarEn(estado, ctx, idsCaja) {
  const i = idsCaja.indexOf(NUEVO);
  if (i < 0) return estado;
  const ids = ctx.movibles.map(x => x.id);
  const antes = i > 0 ? ids.indexOf(idsCaja[i - 1]) : -1;
  const despues = i < idsCaja.length - 1 ? ids.indexOf(idsCaja[i + 1]) : -1;
  const pos = antes >= 0 ? antes + 1 : despues >= 0 ? despues : null;
  if (pos == null) return estado;
  return { ...estado, posicion: masCercana(posicionesValidas(ctx, grupoDe(estado.form)), pos) };
}

/** Para que el paso 2 entre sin scroll: si la lista no entra, se muestran
    el nuevo ±`radio` (pegado al borde si no alcanzan) y lo demás se pliega
    en "+N" arriba y abajo. Plegar UNA sola fila no ahorra nada — la fila
    "+1 más" ocupa lo mismo —, así que con 2·radio+2 filas se ven todas. */
export function recortar(filas, idx, radio = 3) {
  const max = 2 * radio + 1;
  if (filas.length <= max + 1) return { desde: 0, hasta: filas.length, arriba: 0, abajo: 0, visibles: filas };
  const desde = Math.max(0, Math.min(idx - radio, filas.length - max));
  const hasta = desde + max;
  return { desde, hasta, arriba: desde, abajo: filas.length - hasta, visibles: filas.slice(desde, hasta) };
}

/** Todo lo que pinta el paso 2: las filas (fijos arriba, después los
    movibles con el nuevo ya insertado), numeradas; dónde está el nuevo; la
    sugerencia; si ▲▼ pueden moverse; y el recorte. */
export function listaPaso2(estado, ctx, { radio = 3 } = {}) {
  const cat = grupoDe(estado.form);
  const validas = posicionesValidas(ctx, cat);
  const sugerida = posicionSugerida(ctx, cat);
  const pos = posicionDe(estado, ctx);
  const movs = [...ctx.movibles];
  movs.splice(pos, 0, { id: NUEVO, name: estado.form.name.trim(), cat, estado: 'nuevo', nuevo: true });
  const filas = [
    ...ctx.fijos.map(x => ({ ...x, fijo: true })),
    ...movs.map(x => ({ ...x, fijo: false })),
  ].map((x, i) => ({ ...x, n: i + 1 }));
  const idxNuevo = ctx.fijos.length + pos;
  const k = validas.indexOf(pos);
  return {
    filas, idxNuevo, pos, sugerida,
    enSugerida: pos === masCercana(validas, sugerida.pos),
    puedeSubir: k > 0, puedeBajar: k < validas.length - 1,
    recorte: recortar(filas, idxNuevo, radio),
  };
}

/* ---------- guardar ---------- */

/** La posición del paso 2, traducida a un ancla para addSessionExercise:
    antes del pendiente que ocupa ese lugar, o después del último pendiente.
    Un ancla y no un índice porque en el borrador los fijos y los pendientes
    pueden estar intercalados (hiciste el 3º antes que el 2º). */
export function destinoSesion(ctx, pos) {
  const m = ctx.movibles;
  if (pos < m.length) return { antesDe: m[pos].id };
  if (m.length) return { despuesDe: m[m.length - 1].id };
  return {};
}

/** El CTA del paso 3: guarda donde la persona lo dejó. Rutina: saveExercise
    en el índice del orden visible (sin cerrar la hoja: la cierra el
    componente, con su propia salida). Sesión: addSessionExercise, sólo en
    el borrador. Devuelve el ejercicio, o null si no se pudo. */
export async function confirmarAgregar(estado, index) {
  const sesion = estado.tipo === 'sesion';
  const ctx = sesion ? contextoSesion(index) : contextoRutina(index);
  const pos = posicionDe(estado, ctx);
  const datos = datosParaGuardar(estado.form);
  if (sesion) return addSessionExercise(datos, destinoSesion(ctx, pos));
  return (await saveExercise(index, null, datos, { mantenerSheet: true, posicion: pos })) || null;
}
