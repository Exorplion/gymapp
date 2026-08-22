// De qué ejercicio es cada pictograma.
//
// Mismo criterio que catOf() en muscle.js, y por el mismo motivo: la tabla está
// ordenada de lo MÁS específico a lo más genérico, porque los nombres se pisan.
// "Curl femoral" tiene que caer en la máquina de femoral antes de que "curl" lo
// mande al de bíceps, y "JM press" en tríceps antes de que "press" lo mande a
// la banca.
//
// Es una lista y no un objeto justamente por eso: el orden es la lógica.
import { norm } from './format.js';

const TABLA = [
  // femoral antes que curl de bíceps
  ['curl femoral', 'legcurl'], ['hamstring curl', 'legcurl'], ['leg curl', 'legcurl'],
  ['femoral', 'legcurl'], ['isquio', 'legcurl'],

  // las extensiones de pierna antes que las de tríceps
  ['extensiones de cuadricep', 'legext'], ['extension de cuadricep', 'legext'],
  ['leg extension', 'legext'], ['cuadricep', 'legext'],

  // tríceps antes que press
  ['jm press', 'pushdown'], ['extension sobre cabeza', 'sobrecabeza'],
  ['frances', 'sobrecabeza'], ['skull', 'sobrecabeza'], ['copa', 'sobrecabeza'],
  ['pushdown', 'pushdown'], ['tricep', 'pushdown'],

  // hombro antes que press
  ['press militar', 'militar'], ['militar', 'militar'], ['overhead press', 'militar'],
  ['press hombro', 'militar'], ['arnold', 'militar'],
  ['elevaciones laterales', 'lateral'], ['elevacion lateral', 'lateral'],
  ['lateral raise', 'lateral'], ['elevaciones frontales', 'lateral'],
  ['pajaro', 'pajaro'], ['rear delt', 'pajaro'], ['face pull', 'pajaro'],

  // espalda
  ['dominada', 'dominadas'], ['pull up', 'dominadas'], ['pull-up', 'dominadas'],
  ['chin up', 'dominadas'],
  ['jalon', 'jalon'], ['pulldown', 'jalon'],
  ['remo en polea', 'remopolea'], ['remo sentado', 'remopolea'], ['seated row', 'remopolea'],
  ['remo', 'remo'], ['row', 'remo'],
  ['peso muerto rumano', 'pesomuerto'], ['rumano', 'pesomuerto'], ['rdl', 'pesomuerto'],
  ['sldl', 'pesomuerto'], ['peso muerto', 'pesomuerto'], ['deadlift', 'pesomuerto'],
  ['back extension', 'backext'], ['hiperext', 'backext'], ['lumbar', 'backext'],

  // pierna
  ['leg press', 'prensa'], ['prensa', 'prensa'],
  ['sentadilla', 'sentadilla'], ['squat', 'sentadilla'], ['hack', 'sentadilla'],
  ['zancada', 'zancada'], ['lunge', 'zancada'], ['estocada', 'zancada'],
  ['bulgara', 'zancada'], ['split squat', 'zancada'],
  ['aductor', 'aductor'], ['abductor', 'aductor'],
  ['hip thrust', 'hipthrust'], ['puente de gluteo', 'hipthrust'], ['gluteo', 'hipthrust'],
  ['patada', 'hipthrust'],

  // gemelos
  ['calf', 'gemelos'], ['gemelo', 'gemelos'], ['pantorrilla', 'gemelos'], ['soleo', 'gemelos'],

  // abs
  ['rueda abdominal', 'rueda'], ['ab wheel', 'rueda'],
  ['crunch', 'abs'], ['abdomin', 'abs'], ['abs', 'abs'], ['plancha', 'abs'], ['oblicuo', 'abs'],

  // bíceps
  ['curl', 'curl'], ['bicep', 'curl'], ['predicador', 'curl'], ['martillo', 'curl'],

  // pecho: lo último, porque "press" es la palabra más ambigua de todas
  ['pec deck', 'aperturas'], ['apertura', 'aperturas'], ['fly', 'aperturas'],
  ['cruce', 'aperturas'], ['contractor', 'aperturas'],
  ['fondos', 'fondos'], ['dips', 'fondos'], ['dip', 'fondos'],
  ['press inclinado', 'inclinado'], ['inclinado', 'inclinado'], ['incline', 'inclinado'],
  ['press declinado', 'banca'], ['declinado', 'banca'],
  ['press banca', 'banca'], ['banca', 'banca'], ['bench', 'banca'],
  ['press', 'banca'],
];

/**
 * Clave del pictograma de un ejercicio. Acepta el objeto o sólo el nombre.
 *
 * Devuelve 'generico' si no reconoce el movimiento — nunca null: una tarjeta
 * sin dibujo al lado de otras que sí lo tienen se ve rota, no vacía.
 */
export function iconOf(ex) {
  const n = norm(typeof ex === 'string' ? ex : ex?.name);
  if (!n) return 'generico';
  for (const [clave, icono] of TABLA) if (n.includes(clave)) return icono;
  return 'generico';
}
