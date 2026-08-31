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
  ['encogimiento', { p: ['Trapecio'] }],
  ['remo', { p: ['Dorsal alto', 'Dorsal bajo'], s: ['Bíceps'] }],
  ['row', { p: ['Dorsal alto', 'Dorsal bajo'], s: ['Bíceps'] }],

  ['back extension', { p: ['Dorsal bajo'], s: ['Glúteo'] }],
  ['hiperext', { p: ['Dorsal bajo'], s: ['Glúteo'] }],

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
  ['peso muerto rumano', { p: ['Femoral'], s: ['Glúteo', 'Dorsal bajo'] }],
  ['rumano', { p: ['Femoral'], s: ['Glúteo'] }],
  ['sldl', { p: ['Femoral'], s: ['Glúteo'] }],
  ['peso muerto', { p: ['Femoral', 'Glúteo'], s: ['Dorsal bajo', 'Trapecio'] }],

  ['extensiones de cuadricep', { p: ['Vasto interno', 'Vasto externo'] }],
  ['leg extension', { p: ['Vasto interno', 'Vasto externo'] }],
  ['sentadilla', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['squat', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['prensa', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['leg press', { p: ['Vasto externo', 'Vasto interno'], s: ['Glúteo'] }],
  ['zancada', { p: ['Vasto externo'], s: ['Glúteo'] }],
  ['lunge', { p: ['Vasto externo'], s: ['Glúteo'] }],
  ['bulgara', { p: ['Vasto externo'], s: ['Glúteo'] }],

  ['hip thrust', { p: ['Glúteo'], s: ['Femoral'] }],
  ['patada', { p: ['Glúteo'] }],
  ['aductor', { p: ['Aductores'] }],
  ['abductor', { p: ['Glúteo'] }],

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
  'Tríceps', 'Tríceps cabeza larga',
  'Hombro', 'Glúteo', 'Gemelos', 'Femoral', 'Aductores',
]);

/** ¿Este nombre es un grupo entero (o una porción sin parche propio) y no una
    subzona con su propia forma en la lámina? */
export const esGrupo = n => GRUPOS.has(n);

/** Cómo se pinta cada nombre sobre el cuerpo.

    Femoral, Aductores, Bíceps braquial, Braquiorradial y Tríceps
    medial-lateral no tienen subzona propia en la lámina, así que se pintan
    con el grupo entero. Es menos preciso que el nombre, y prefiero que el
    dibujo diga de menos antes que señalar el músculo equivocado. */
export const ZONA_DE = {
  Femoral: 'Pierna',
  Aductores: 'Pierna',
  Bíceps: 'Bíceps',
  'Bíceps braquial': 'Bíceps',
  Braquiorradial: 'Bíceps',
  Tríceps: 'Tríceps',
  'Tríceps cabeza larga': 'Tríceps',
  Hombro: 'Hombro',
  Glúteo: 'Glúteo',
  Gemelos: 'Gemelos',
};
