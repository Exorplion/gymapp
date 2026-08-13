// Grupo muscular de un ejercicio, y volumen semanal por grupo.
//
// El problema que esto resuelve: catOf() exigía que el nombre registrado
// CONTUVIERA al del catálogo, y muscleVolume descartaba en silencio lo que no
// matcheaba. Con la rutina real de Enzo eso dejaba 18 de 22 ejercicios sin
// clasificar — su pecho, su espalda, sus piernas, sus tríceps y sus abs no
// aparecían en "Músculos esta semana", que mostraba un resumen incompleto como
// si fuera completo.
//
// El caso que lo resume: "Press inclinado" fallaba porque el catálogo dice
// "Press inclinado mancuernas". El match iba en una sola dirección.
import { S } from './state.js';
import { dstr, norm } from './format.js';
import { fibrasDe } from './fibras.js';

/** Los nueve grupos, en el orden en que se muestran. */
export const MUSCLE_CATS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Glúteo', 'Gemelos', 'Abs'];

/** Base de ejercicios para el selector de "Nuevo ejercicio" y para clasificar. */
export const EXCATALOG = [
  { c: 'Pecho', n: 'Press banca' }, { c: 'Pecho', n: 'Press inclinado mancuernas' }, { c: 'Pecho', n: 'Aperturas en polea' },
  { c: 'Pecho', n: 'Fondos' }, { c: 'Pecho', n: 'Press declinado' },
  { c: 'Pecho', n: 'Press plano máquina' }, { c: 'Pecho', n: 'Press inclinado' }, { c: 'Pecho', n: 'Pec deck' },
  { c: 'Espalda', n: 'Dominadas' }, { c: 'Espalda', n: 'Remo con barra' }, { c: 'Espalda', n: 'Jalón al pecho' },
  { c: 'Espalda', n: 'Remo en polea' }, { c: 'Espalda', n: 'Peso muerto' },
  { c: 'Espalda', n: 'Jalón ancho' }, { c: 'Espalda', n: 'Remo espalda alta' }, { c: 'Espalda', n: 'Remo neutro' },
  { c: 'Espalda', n: 'Back extension' },
  { c: 'Hombro', n: 'Press militar' }, { c: 'Hombro', n: 'Elevaciones laterales' }, { c: 'Hombro', n: 'Pájaros' }, { c: 'Hombro', n: 'Face pull' },
  { c: 'Bíceps', n: 'Curl con barra' }, { c: 'Bíceps', n: 'Curl martillo' }, { c: 'Bíceps', n: 'Curl inclinado' },
  { c: 'Bíceps', n: 'Curl predicador' },
  { c: 'Tríceps', n: 'Extensión tríceps polea' }, { c: 'Tríceps', n: 'Extensión sobre cabeza' },
  { c: 'Tríceps', n: 'Extensión tríceps' }, { c: 'Tríceps', n: 'JM press' },
  { c: 'Pierna', n: 'Sentadilla' }, { c: 'Pierna', n: 'Prensa' }, { c: 'Pierna', n: 'Peso muerto rumano' },
  { c: 'Pierna', n: 'Extensiones de cuádriceps' }, { c: 'Pierna', n: 'Curl femoral' }, { c: 'Pierna', n: 'Zancadas' },
  { c: 'Pierna', n: 'Leg press' }, { c: 'Pierna', n: 'Leg extension' }, { c: 'Pierna', n: 'Hamstring curl' },
  { c: 'Pierna', n: 'Aductor' }, { c: 'Pierna', n: 'Abductor' },
  { c: 'Glúteo', n: 'Hip thrust' }, { c: 'Gemelos', n: 'Elevación de gemelos' },
  { c: 'Gemelos', n: 'Standing calf raise' },
  { c: 'Abs', n: 'Crunch en polea' }, { c: 'Abs', n: 'Rueda abdominal' }, { c: 'Abs', n: 'Abs polea' },
];

/* Palabras clave, de lo MÁS específico a lo más genérico. El orden es la parte
   que importa y por eso esto es una lista y no un objeto: "Hamstring curl"
   tiene que caer en Pierna antes de que "curl" lo mande a Bíceps, y "Press
   militar" en Hombro antes de que "press" lo mande a Pecho. */
const KEYWORDS = [
  // pierna antes que bíceps, porque llevan "curl"
  ['hamstring', 'Pierna'], ['femoral', 'Pierna'], ['isquio', 'Pierna'],
  // hombro y tríceps antes que pecho, porque llevan "press"
  ['press militar', 'Hombro'], ['militar', 'Hombro'], ['overhead press', 'Hombro'],
  ['jm press', 'Tríceps'], ['tricep', 'Tríceps'], ['pushdown', 'Tríceps'],
  ['frances', 'Tríceps'], ['skull', 'Tríceps'], ['extension sobre cabeza', 'Tríceps'],
  // espalda
  ['jalon', 'Espalda'], ['pulldown', 'Espalda'], ['dominada', 'Espalda'], ['pull up', 'Espalda'],
  ['remo', 'Espalda'], ['row', 'Espalda'], ['espalda', 'Espalda'], ['dorsal', 'Espalda'],
  ['back extension', 'Espalda'], ['hiperext', 'Espalda'], ['lumbar', 'Espalda'],
  // pierna
  ['sldl', 'Pierna'], ['rumano', 'Pierna'], ['rdl', 'Pierna'],
  ['leg press', 'Pierna'], ['leg extension', 'Pierna'], ['leg curl', 'Pierna'],
  ['sentadilla', 'Pierna'], ['squat', 'Pierna'], ['prensa', 'Pierna'],
  ['cuadricep', 'Pierna'], ['zancada', 'Pierna'], ['lunge', 'Pierna'],
  ['aductor', 'Pierna'], ['abductor', 'Pierna'], ['pierna', 'Pierna'],
  // gemelos antes que nada que lleve "raise"
  ['calf', 'Gemelos'], ['gemelo', 'Gemelos'], ['pantorrilla', 'Gemelos'], ['soleo', 'Gemelos'],
  // hombro
  ['elevaciones laterales', 'Hombro'], ['lateral raise', 'Hombro'], ['pajaro', 'Hombro'],
  ['face pull', 'Hombro'], ['rear delt', 'Hombro'], ['deltoide', 'Hombro'], ['hombro', 'Hombro'],
  // glúteo
  ['hip thrust', 'Glúteo'], ['gluteo', 'Glúteo'], ['patada', 'Glúteo'], ['puente', 'Glúteo'],
  // abs
  ['abs', 'Abs'], ['abdomin', 'Abs'], ['crunch', 'Abs'], ['plancha', 'Abs'],
  ['rueda abdominal', 'Abs'], ['oblicuo', 'Abs'],
  // bíceps
  ['predicador', 'Bíceps'], ['preacher', 'Bíceps'], ['martillo', 'Bíceps'],
  ['hammer', 'Bíceps'], ['curl', 'Bíceps'], ['bicep', 'Bíceps'],
  // pecho, lo último porque "press" es la palabra más ambigua de todas
  ['pec deck', 'Pecho'], ['aperturas', 'Pecho'], ['apertura', 'Pecho'], ['fondos', 'Pecho'],
  ['dips', 'Pecho'], ['banca', 'Pecho'], ['inclinado', 'Pecho'], ['declinado', 'Pecho'],
  ['pecho', 'Pecho'], ['press', 'Pecho'],
];

/**
 * Grupo muscular de un ejercicio. Acepta el objeto o sólo el nombre.
 *
 * Resuelve en cuatro pasos, en orden:
 *   1. `ex.cat` explícito gana — ninguna lista de palabras va a adivinar
 *      "JM press unilateral", así que tiene que haber una salida manual.
 *   2. lo registrado contiene al catálogo → gana la entrada más LARGA, la más
 *      específica (la regla de siempre).
 *   3. el catálogo contiene a lo registrado → gana la más CORTA, la más cercana
 *      a lo que escribiste. Es la dirección que faltaba, y la que arregla
 *      "Press inclinado" contra "Press inclinado mancuernas".
 *   4. tabla de palabras clave ordenada.
 *
 * Devuelve null si no reconoce nada: nunca inventa una categoría.
 */
export function catOf(ex) {
  if (ex && typeof ex === 'object' && ex.cat) return ex.cat;
  const n = norm(typeof ex === 'string' ? ex : ex?.name);
  if (!n) return null;

  let contenido = null, lenC = 0;      // paso 2
  let contenedor = null, lenD = Infinity; // paso 3
  for (const e of EXCATALOG) {
    const ne = norm(e.n);
    if (!ne) continue;
    if (n.includes(ne)) { if (ne.length > lenC) { contenido = e.c; lenC = ne.length; } }
    // sólo para nombres de 4+ caracteres: un fragmento corto se llevaría por
    // delante media tabla
    else if (n.length >= 4 && ne.includes(n)) { if (ne.length < lenD) { contenedor = e.c; lenD = ne.length; } }
  }
  if (contenido) return contenido;
  if (contenedor) return contenedor;

  for (const [kw, cat] of KEYWORDS) if (n.includes(kw)) return cat;
  return null;
}

/** Series por grupo muscular en los últimos `days` días.

    Lee el `cat` que quedó guardado en cada entrada: sin eso el volumen
    histórico dependería de la rutina de hoy, y renombrar un ejercicio
    reescribiría el pasado. */
export function muscleVolume(days) {
  const cutoff = dstr(new Date(Date.now() - days * 86400000)), tally = {};
  S.sessions.filter(s => s.date >= cutoff).forEach(s => (s.entries || []).forEach(e => {
    const c = catOf(e);
    if (c) tally[c] = (tally[c] || 0) + e.sets.length;
  }));
  return tally;
}

/** Días enteros entre dos fechas YYYY-MM-DD, en hora local.
    El mediodía evita que el horario de verano corra el resultado un día. */
function diasEntre(desde, hasta) {
  const a = new Date(desde + 'T12:00:00');
  const b = new Date(hasta + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

/** Hace cuántos días entrenaste este grupo por última vez.

    `null` = nunca, y es distinto de "hace mucho": un grupo sin historial no
    tiene por qué aparecer marcado, o la app le estaría gritando a alguien
    recién llegado por algo que todavía no hizo mal.

    Es un hecho, no un modelo. Deliberadamente NO se llama "recuperación": eso
    sería una afirmación fisiológica que la app no puede sostener. */
export function daysSinceGroup(cat) {
  let ultima = null;
  for (const s of S.sessions || []) {
    const tiene = (s.entries || []).some(e => e.sets?.length && catOf(e) === cat);
    if (!tiene) continue;
    if (ultima === null || s.date > ultima) ultima = s.date;
  }
  return ultima === null ? null : Math.max(0, diasEntre(ultima, dstr()));
}

/** El mapa completo de los nueve grupos, para pasárselo a la silueta. */
export function daysSinceAll() {
  const out = {};
  MUSCLE_CATS.forEach(c => { out[c] = daysSinceGroup(c); });
  return out;
}

/** Los grupos que llevan `min` días o más sin entrenar, del más viejo al más
    nuevo. Sólo los que TIENEN historial. */
export function stalestGroups(min = 7) {
  return MUSCLE_CATS
    .map(c => ({ c, d: daysSinceGroup(c) }))
    .filter(x => x.d !== null && x.d >= min)
    .sort((a, b) => b.d - a.d)
    .map(x => x.c);
}

/** Cuántos días lleva sin entrenarse, en castellano. `null` es "nunca". */
export function diasTexto(d) {
  if (d === null || d === undefined) return 'nunca';
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

/**
 * Todo lo que la app sabe de un grupo muscular, para el globo de Inicio.
 *
 * La ventana es de 28 días y no de 30 porque son cuatro semanas exactas: así
 * "veces por semana" es una división limpia y no un promedio con resto.
 *
 * Cuenta series y no repeticiones porque las series son la unidad con la que
 * se programa un entrenamiento. El volumen en kg va aparte, para el que lo
 * quiera mirar.
 *
 * Todo lo que devuelve es un hecho medido. No hay ninguna recomendación: la
 * app no sabe si entrenaste poco o mucho, sólo cuánto.
 */
export function groupStats(cat, ventana = 28) {
  const cutoff = dstr(new Date(Date.now() - ventana * 86400000));
  let sets = 0, volumen = 0, sesiones = 0, mejor = null;
  const porEx = new Map();
  // fibra -> (nombre de ejercicio -> series). Un Map de Maps y no un objeto
  // plano porque el nombre de la fibra puede traer tildes/espacios y este
  // camino nunca necesita usarlo como key de JSON ni nada por el estilo.
  const porFibra = new Map();

  for (const s of S.sessions || []) {
    if (s.date < cutoff) continue;
    let tocado = false;
    for (const e of s.entries || []) {
      if (catOf(e) !== cat) continue;
      const ss = (e.sets || []).filter(x => x && x.r);
      if (!ss.length) continue;
      tocado = true;
      sets += ss.length;
      for (const st of ss) {
        volumen += (st.w || 0) * (st.r || 0);
        if (!mejor || (st.w || 0) > mejor.w) mejor = { w: st.w || 0, r: st.r, name: e.name };
      }
      porEx.set(e.name, (porEx.get(e.name) || 0) + ss.length);

      /* Sin fibra reconocida, el ejercicio cae bajo el nombre del grupo
         entero (cat) — no bajo un "otros" inventado. Es honesto: "esto
         trabaja Espalda" es lo único que sabemos de verdad de un ejercicio
         sin mapear, y es lo mismo que ya decía antes de que existiera este
         desglose. */
      const fib = fibrasDe(e);
      const principales = fib?.p?.length ? fib.p : [cat];
      for (const nombreFibra of principales) {
        if (!porFibra.has(nombreFibra)) porFibra.set(nombreFibra, new Map());
        const porExDeFibra = porFibra.get(nombreFibra);
        porExDeFibra.set(e.name, (porExDeFibra.get(e.name) || 0) + ss.length);
      }
    }
    if (tocado) sesiones++;
  }

  /* Sólo vale la pena mostrar el desglose si hay MÁS de una fibra real: un
     grupo donde todo cae en una sola bolsa (Glúteo, Gemelos) no gana nada
     mostrando "Glúteo: Hip thrust" en vez de la lista plana de siempre —
     sería la misma información con un paso extra. */
  const fibras = porFibra.size > 1
    ? [...porFibra.entries()]
      .map(([fibra, ejPorNombre]) => {
        const ejercicios = [...ejPorNombre.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => ({ name, sets: n }));
        return { fibra, sets: ejercicios.reduce((a, e) => a + e.sets, 0), ejercicios };
      })
      .sort((a, b) => b.sets - a.sets)
    : null;

  return {
    cat,
    ventana,
    dias: daysSinceGroup(cat),
    sets,
    sesiones,
    volumen: Math.round(volumen),
    mejor,
    /** Sesiones por semana, con un decimal. */
    porSemana: Math.round((sesiones / (ventana / 7)) * 10) / 10,
    /** Los ejercicios con los que más lo trabajaste, de más a menos series. */
    top: [...porEx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, sets: n })),
    /** Lo mismo que `top`, pero agrupado por fibra — null si el grupo no
        tiene más de una fibra distinta entre lo que registraste (ver arriba). */
    fibras,
  };
}

/** Ejercicios de la rutina que no caen en ningún grupo.

    Existe para que el fallo deje de ser silencioso: la tarjeta de músculos los
    nombra y ofrece asignarlos. Un resumen incompleto presentado como completo
    es peor que no tener resumen. */
export function uncategorized() {
  const out = [];
  Object.values(S.routine || {}).forEach(d => (d.exercises || []).forEach(e => {
    if (!catOf(e)) out.push(e);
  }));
  return out;
}
