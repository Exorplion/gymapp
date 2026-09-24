// Qué porción del músculo trabaja cada ejercicio.
//
// El grupo solo no alcanza: la hipertrofia es por fibra, y "espalda" mete en la
// misma bolsa un jalón —que carga el dorsal en su porción baja— y un remo
// neutro, que pega arriba. Decidir la rutina con esa etiqueta es decidir a
// ciegas.
//
// Las subzonas salen de la lámina anatómica (lib/bodydata.js): son las mismas
// formas que MuscleMap dibuja para resaltar una porción, así que lo que se
// nombra acá se puede pintar en el cuerpo sin inventar geometría.
//
// LÍMITE HONESTO: esto es una guía, no una medición. Qué porción trabaja más un
// ejercicio depende del ángulo, del agarre y de cómo lo hacés vos. Las
// asignaciones siguen el consenso habitual de entrenamiento —el jalón carga más
// abajo, el remo con codo pegado carga más arriba, el press inclinado carga el
// clavicular— pero nadie midió TU electromiografía. Por eso se muestra como
// "trabaja" y no como un porcentaje: un número daría una precisión que no
// existe.
import { norm } from './format.js';
import { CUERPOS } from './bodydata.js';

/* La tabla va de lo MÁS específico a lo más genérico, igual que catOf: el orden
   ES la lógica. "Curl femoral" tiene que caer en femoral antes de que "curl" lo
   mande a bíceps, y "press inclinado" en clavicular antes de que "press" lo
   mande al pecho entero.

   `p` son las porciones principales; `s` las que acompañan. */
const TABLA = [
  // ---- espalda: la distinción que pidió Enzo ----
  ['jalon al pecho', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['jalon ancho', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['jalon', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['pulldown', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['dominada', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['pull up', { p: ['Dorsal bajo'], s: ['Bíceps'] }],
  ['pullover', { p: ['Dorsal bajo'] }],

  ['remo espalda alta', { p: ['Dorsal alto', 'Trapecio'] }],
  ['remo neutro', { p: ['Dorsal alto'], s: ['Bíceps'] }],
  ['remo en polea', { p: ['Dorsal alto'], s: ['Bíceps'] }],
  ['remo sentado', { p: ['Dorsal alto'], s: ['Bíceps'] }],
  ['face pull', { p: ['Trapecio'] }],
  // Kelso: encogimiento en posición de remo — trapecio medio, sin bíceps
  // (el codo no se flexiona), por eso no lleva secundarios.
  ['kelso', { p: ['Trapecio', 'Dorsal alto'] }],
  ['shrug', { p: ['Trapecio'] }],
  ['encogimiento', { p: ['Trapecio'] }],
  ['remo', { p: ['Dorsal alto', 'Dorsal bajo'], s: ['Bíceps'] }],
  ['row', { p: ['Dorsal alto', 'Dorsal bajo'], s: ['Bíceps'] }],

  // Lumbares tiene zona propia desde 2026-09-24: la pieza que la lámina
  // llamaba "lowerBack" era el erector espinal, y se la había rotulado
  // "Dorsal bajo" — así un jalón encendía los lumbares. Ahora "Dorsal bajo"
  // es el dorsal ancho y el erector es 'Lumbares' (ver bodydata.js).
  ['back extension', { p: ['Lumbares'], s: ['Glúteo mayor'] }],
  ['hiperext', { p: ['Lumbares'], s: ['Glúteo mayor'] }],
  ['good morning', { p: ['Lumbares'], s: ['Femoral', 'Glúteo mayor'] }],
  ['reverse hyper', { p: ['Lumbares'], s: ['Glúteo mayor'] }],
  ['rack pull', { p: ['Femoral', 'Glúteo mayor'], s: ['Lumbares', 'Trapecio'] }],

  // ---- bíceps (sólo los nombres compuestos): van ANTES que pecho a propósito ----
  // "Curl inclinado" tiene que ganarle al "inclinado" genérico de pecho de
  // acá abajo — si no, un ejercicio de brazo cae clasificado como pecho. El
  // orden ES la lógica (ver cabecera del archivo). El "curl" genérico NO se
  // mueve para acá: se queda en su lugar de siempre, más abajo, DESPUÉS de
  // "curl femoral"/"hamstring curl"/"leg curl" — si se moviera con estos,
  // "Curl femoral" quedaría clasificado como bíceps en vez de isquiotibial.
  //
  // Bíceps braquial (agarre supinado) vs braquiorradial (agarre neutro o
  // pronado): son dos músculos distintos que responden a agarres distintos,
  // no una sola bolsa "bíceps".
  ['curl predicador', { p: ['Bíceps braquial'] }],
  ['curl inclinado', { p: ['Bíceps braquial'] }],
  ['curl martillo', { p: ['Braquiorradial'] }],
  ['curl inverso', { p: ['Braquiorradial'] }],
  ['reverse curl', { p: ['Braquiorradial'] }],

  // ---- pecho: clavicular arriba, costal abajo ----
  ['press inclinado', { p: ['Clavicular'], s: ['Deltoides anterior', 'Tríceps'] }],
  ['inclinado', { p: ['Clavicular'], s: ['Deltoides anterior'] }],
  ['press declinado', { p: ['Costal'] }],
  ['declinado', { p: ['Costal'] }],
  ['fondos', { p: ['Costal'], s: ['Tríceps'] }],
  ['dips', { p: ['Costal'], s: ['Tríceps'] }],
  ['pec deck', { p: ['Clavicular', 'Costal'] }],
  ['apertura', { p: ['Clavicular', 'Costal'] }],
  ['cruce', { p: ['Costal'] }],
  ['press banca', { p: ['Clavicular', 'Costal'], s: ['Tríceps', 'Deltoides anterior'] }],
  ['banca', { p: ['Clavicular', 'Costal'], s: ['Tríceps'] }],
  ['press plano', { p: ['Clavicular', 'Costal'], s: ['Tríceps'] }],

  // ---- hombro ----
  ['press militar', { p: ['Deltoides anterior'], s: ['Tríceps'] }],
  ['militar', { p: ['Deltoides anterior'], s: ['Tríceps'] }],
  ['elevaciones laterales', { p: ['Hombro'] }],
  ['lateral raise', { p: ['Hombro'] }],
  ['pajaro', { p: ['Hombro', 'Trapecio'] }],

  // ---- pierna: vasto interno / externo ----
  ['curl femoral', { p: ['Femoral'] }],
  ['hamstring curl', { p: ['Femoral'] }],
  ['leg curl', { p: ['Femoral'] }],
  ['femoral', { p: ['Femoral'] }],
  ['peso muerto rumano', { p: ['Femoral'], s: ['Glúteo mayor', 'Lumbares'] }],
  ['rumano', { p: ['Femoral'], s: ['Glúteo'] }],
  ['sldl', { p: ['Femoral'], s: ['Glúteo'] }],
  ['peso muerto', { p: ['Femoral', 'Glúteo mayor'], s: ['Lumbares', 'Trapecio'] }],

  ['extensiones de cuadricep', { p: ['Vasto interno', 'Vasto externo'] }],
  ['leg extension', { p: ['Vasto interno', 'Vasto externo'] }],
  ['sentadilla', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['squat', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['prensa', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['leg press', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['zancada', { p: ['Vasto externo'], s: ['Glúteo'] }],
  ['lunge', { p: ['Vasto externo'], s: ['Glúteo'] }],
  ['bulgara', { p: ['Vasto externo'], s: ['Glúteo'] }],

  // Glúteo mayor (extensión de cadera) contra glúteo medio (abducción): son
  // las dos piezas que la lámina dibuja por separado en la cara de atrás.
  ['hip thrust', { p: ['Glúteo mayor'], s: ['Femoral'] }],
  ['puente de gluteo', { p: ['Glúteo mayor'], s: ['Femoral'] }],
  ['patada', { p: ['Glúteo mayor'] }],
  ['aductor', { p: ['Aductores'] }],
  ['abductor', { p: ['Glúteo medio'] }],
  ['abduccion', { p: ['Glúteo medio'] }],

  // Gemelos: con la rodilla doblada el gastrocnemio queda acortado y el que
  // trabaja es el sóleo; de pie (rodilla estirada) el gastrocnemio carga más.
  // Por eso se afinan sólo las variantes que dicen la postura; la genérica
  // queda en el grupo entero, que enciende las dos piezas.
  ['talones sentado', { p: ['Sóleo'] }],
  ['gemelo sentado', { p: ['Sóleo'] }],
  ['gemelos sentado', { p: ['Sóleo'] }],
  ['pantorrilla sentado', { p: ['Sóleo'] }],
  ['calf sentado', { p: ['Sóleo'] }],
  ['seated calf', { p: ['Sóleo'] }],
  ['soleo', { p: ['Sóleo'] }],
  ['talones de pie', { p: ['Gastrocnemio'] }],
  ['gemelos de pie', { p: ['Gastrocnemio'] }],
  ['standing calf', { p: ['Gastrocnemio'] }],
  ['calf', { p: ['Gemelos'] }],
  ['gemelo', { p: ['Gemelos'] }],
  ['pantorrilla', { p: ['Gemelos'] }],

  // ---- brazo ----
  // El resto de bíceps (curl predicador/inclinado/martillo/inverso) vive
  // arriba, antes de pecho — ver la nota ahí. Acá sólo queda el genérico, que
  // SÍ tiene que estar después de "curl femoral"/"hamstring curl"/"leg curl"
  // (sección de pierna, más arriba): moverlo con el resto haría que "Curl
  // femoral" cayera clasificado como bíceps.
  ['curl', { p: ['Bíceps braquial'] }],
  // Tríceps: corregido con estudios reales — antes decía lo contrario y
  // estaba anotado como "lectura propia, no una cita" (ver commit previo).
  // La cabeza LARGA se origina en la escápula, así que se estira más con el
  // brazo elevado (overhead), y un músculo más estirado en el punto de
  // máxima tensión crece más: Maeo et al. 2022 (European Journal of Sport
  // Science) midieron +28.5% de crecimiento en la cabeza larga con extensión
  // overhead contra +19.6% con pushdown (codo pegado al cuerpo) en 12
  // semanas — las cabezas lateral+medial subieron parejo entre ejercicios
  // (+14.6% vs +10.5%), la diferencia grande está en la larga. Boehler 2011
  // (EMG, n=15) encontró que el pushdown activa más la cabeza LATERAL en
  // relación a la larga que las variantes overhead. JM press, skullcrusher y
  // dips no tienen estudio que los mida cabeza por cabeza — quedan en el
  // genérico 'Tríceps', sin inventar cuál cabeza priorizan.
  ['jm press', { p: ['Tríceps'] }],
  ['skullcrusher', { p: ['Tríceps'] }],
  ['overhead', { p: ['Tríceps cabeza larga'] }],
  ['extension sobre cabeza', { p: ['Tríceps cabeza larga'] }],
  ['tricep', { p: ['Tríceps'] }],
  ['pushdown', { p: ['Tríceps'] }],

  // ---- abdomen ----
  ['rueda abdominal', { p: ['Abdomen inferior', 'Abdomen superior'] }],
  ['crunch', { p: ['Abdomen superior'] }],
  ['elevacion de piernas', { p: ['Abdomen inferior'] }],
  ['oblicuo', { p: ['Oblicuos'] }],
  ['plancha', { p: ['Abdomen superior', 'Abdomen inferior'] }],
  ['abs', { p: ['Abdomen superior', 'Abdomen inferior'] }],
  ['abdomin', { p: ['Abdomen superior', 'Abdomen inferior'] }],
];

/**
 * Qué porciones trabaja un ejercicio. Acepta el objeto o sólo el nombre.
 *
 * Devuelve `{ p: [...], s: [...] }` — principales y secundarias — o null si no
 * lo reconoce. Nunca inventa: sin coincidencia, la ficha no muestra la sección
 * en vez de mostrar una suposición.
 */
export function fibrasDe(ex) {
  const n = norm(typeof ex === 'string' ? ex : ex?.name);
  if (!n) return null;
  for (const [clave, v] of TABLA) {
    if (n.includes(clave)) return { p: v.p, s: v.s || [] };
  }
  return null;
}

/* Los nombres que usa la tabla y NO son subzonas de la lámina: son grupos
   enteros, y se pintan como tales. Tenerlos acá explícitos evita que un typo
   ("Gluteo" sin tilde) se convierta en una zona que nunca se pinta.

   Bíceps braquial, Braquiorradial y Tríceps cabeza larga entran acá por lo
   mismo que Femoral: son un músculo (o una porción) real, pero la lámina no
   tiene un parche propio para ellos — brazo es una sola forma sin costuras.
   Se pintan con el grupo entero (Bíceps/Tríceps) y el texto es el que lleva
   la precisión que el dibujo no puede. */
const GRUPOS = new Set([
  'Bíceps', 'Bíceps braquial', 'Braquiorradial',
  'Tríceps',
  'Hombro', 'Glúteo', 'Gemelos', 'Femoral', 'Aductores', 'Lumbares',
]);

/** ¿Este nombre es un grupo entero (o una porción sin parche propio) y no una
    subzona con su propia forma en la lámina? */
export const esGrupo = n => GRUPOS.has(n);

/** Cómo se pinta cada nombre sobre el cuerpo.

    Femoral, Aductores, Bíceps braquial y Braquiorradial no tienen subzona
    propia en la lámina, así que se pintan con el grupo entero. (La cabeza
    larga del tríceps SÍ la tiene desde 2026-09-24: la cara de atrás dibuja
    las cabezas por separado.) Es menos preciso que el nombre, y prefiero que el
    dibujo diga de menos antes que señalar el músculo equivocado. */
/* Los nombres de porción que la lámina SÍ sabe dibujar, sacados de bodydata.js
   y no escritos a mano: si alguien regenera la lámina y una zona cambia de
   nombre, esta lista se entera sola. Lo que no está acá es un grupo entero
   (Bíceps, Glúteo, Femoral…) y se pinta como grupo, igual que siempre — ver
   GRUPOS/esGrupo más arriba. */
const SUBS_DE_LAMINA = new Set();
/* Las porciones HERMANAS de cada grupo (sin parche): las que entre todas son
   el músculo entero en alguna cara — Espalda, y desde 2026-09-24 también
   Tríceps, Glúteo y Gemelos en la cara de atrás. */
const HERMANAS_DE = new Map();
for (const sexo of ['m', 'f']) {
  for (const cara of ['frente', 'espalda']) {
    for (const z of CUERPOS[sexo][cara].zonas) {
      if (!z.sub) continue;
      SUBS_DE_LAMINA.add(z.sub);
      if (!z.parche && z.cat) {
        if (!HERMANAS_DE.has(z.cat)) HERMANAS_DE.set(z.cat, new Set());
        HERMANAS_DE.get(z.cat).add(z.sub);
      }
    }
  }
}

/** A qué porciones de la lámina se traduce un nombre de `p`.

    Una porción con forma propia es ella misma. El nombre de un grupo ENTERO
    ("Tríceps" en un pushdown, "Gemelos" en un calf genérico) se reparte en
    todas sus hermanas: el ejercicio trabajó el músculo completo. Sin esto, al
    partir el tríceps en cabezas, un pushdown dejaba la cara de atrás
    APAGADA — la silueta habría dicho "no entrenaste tríceps" justo después
    de entrenarlo. Un nombre que no es ni porción ni grupo con hermanas
    ('Femoral', 'Bíceps braquial') no se traduce a nada: se sigue pintando
    con el grupo, como siempre. */
export function porcionesDeLamina(nombre) {
  if (SUBS_DE_LAMINA.has(nombre)) return [nombre];
  if (esGrupo(nombre) && HERMANAS_DE.has(nombre)) return [...HERMANAS_DE.get(nombre)];
  return [];
}

/** Días enteros entre dos fechas YYYY-MM-DD, en hora local.
    El mediodía evita que el horario de verano corra el resultado un día.
    (Es la misma cuenta que hace muscle.ts para los grupos; se repite acá en
    vez de importarla porque muscle.ts YA importa este módulo y cerrar el
    círculo rompería el orden de inicialización de sus constantes.) */
function diasEntre(desde, hasta) {
  const a = new Date(desde + 'T12:00:00');
  const b = new Date(hasta + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Hace cuántos días se trabajó cada PORCIÓN, para poder encender en la silueta
 * la porción y no el grupo grueso.
 *
 * Es el mismo criterio que `daysSinceGroup()` pero un escalón más fino, y con
 * la misma honestidad: una porción de la que no hay registro simplemente NO
 * aparece en el mapa. No se rellena con el dato del grupo (eso sería afirmar
 * que entrenaste el trapecio porque hiciste un jalón) ni con un cero.
 *
 * Sólo cuentan las porciones PRINCIPALES (`p`) de cada ejercicio: las
 * secundarias son asistencia, y pintarlas como trabajadas sería decir de más.
 * Y sólo las que la lámina sabe dibujar — 'Femoral' o 'Bíceps braquial' son
 * porciones reales pero sin forma propia, así que se siguen pintando con su
 * grupo entero.
 *
 * Puro a propósito (recibe las sesiones y el día de hoy): así se testea sin
 * tocar IndexedDB ni el reloj.
 *
 * @param {{date?: string, entries?: {name?: string, sets?: unknown[]}[]}[]} sesiones
 * @param {string} hoy — fecha YYYY-MM-DD
 * @returns {Record<string, number>} sub → días. Las porciones sin registro no
 *   están en el objeto (ausente = sin dato, distinto de 0).
 */
export function diasPorPorcion(sesiones, hoy) {
  const ultima = new Map();
  for (const s of sesiones || []) {
    if (!s?.date) continue;
    for (const e of s.entries || []) {
      // Sin series registradas el ejercicio estaba en la lista pero no se
      // hizo: mismo criterio que daysSinceGroup().
      if (!e?.sets?.length) continue;
      const fib = fibrasDe(e);
      if (!fib) continue;
      for (const sub of fib.p.flatMap(porcionesDeLamina)) {
        const prev = ultima.get(sub);
        if (prev === undefined || s.date > prev) ultima.set(sub, s.date);
      }
    }
  }
  const out = {};
  for (const [sub, fecha] of ultima) out[sub] = Math.max(0, diasEntre(fecha, hoy));
  return out;
}

export const ZONA_DE = {
  Femoral: 'Pierna',
  Aductores: 'Pierna',
  Bíceps: 'Bíceps',
  'Bíceps braquial': 'Bíceps',
  Braquiorradial: 'Bíceps',
  Tríceps: 'Tríceps',
  Lumbares: 'Lumbares',
  Hombro: 'Hombro',
  Glúteo: 'Glúteo',
  Gemelos: 'Gemelos',
};
