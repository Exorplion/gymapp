// Puerto de web/src/lib/exdb.js — base educativa de ejercicios + esquema RIR
// + sessionMaxW/progressionWarn (banner de progresión de Hoy, dependen de
// S.sessions — ver ruling de docs/superpowers/plans/2026-08-23-rn-completar-hoy.md).
import { norm, fmtNum, round1 } from './format.js';
import { S } from './state.js';

/** Cada ejercicio: keywords para matchear, músculos, y por qué elegirlo */
export const EXDB = [
  { k: ['press banca', 'press de banca', 'bench'], m: 'Pectoral mayor · tríceps · deltoides anterior', w: 'Máxima carga absoluta para el pecho = mucha tensión mecánica total. En brazos largos el tríceps a veces cede antes; si es tu caso, combínalo con aislamientos de pecho.' },
  { k: ['press inclinado', 'inclinado'], m: 'Pecho superior (porción clavicular) · deltoides anterior · tríceps', w: 'El ángulo inclinado desplaza la tensión al pecho superior, la zona que más suele faltar para un pecho completo.' },
  { k: ['aperturas', 'apertura', 'fly', 'flys', 'cruces', 'contractora', 'pec deck', 'peck deck'], m: 'Pectoral mayor (aislado)', w: 'Aíslan el pecho sin que el tríceps limite el estímulo — ideal si en los presses el tríceps falla antes que el pecho. La polea mantiene tensión en todo el recorrido.' },
  { k: ['low to high', 'low-to-high', 'de abajo hacia arriba'], m: 'Pecho superior (clavicular)', w: 'Enfatiza el pecho superior sin acumular fatiga de tríceps antes de un press. Buen complemento del inclinado.' },
  { k: ['fondos', 'dips'], m: 'Pecho inferior · tríceps · deltoides anterior', w: 'Gran estímulo de pecho inferior y tríceps con peso corporal; inclinándote al frente cargas más pecho, vertical más tríceps.' },
  { k: ['press militar', 'press hombro', 'overhead press', 'press de hombro', 'ohp'], m: 'Deltoides anterior · deltoides lateral · tríceps', w: 'El press pesado de hombro da la mayor carga total para deltoides; base para construir hombros antes de los aislamientos.' },
  { k: ['elevaciones laterales', 'elevacion lateral', 'laterales', 'lateral raise'], m: 'Deltoides lateral (aislado)', w: 'El deltoides lateral casi solo crece con laterales: los presses lo trabajan poco. Prioriza técnica y control sobre peso.' },
  { k: ['pajaros', 'pajaro', 'rear delt', 'deltoide posterior', 'reverse fly', 'face pull'], m: 'Deltoides posterior · trapecio medio · romboides', w: 'El deltoides posterior es clave para hombros 3D y postura; casi ningún press lo toca. El face pull además cuida el manguito rotador.' },
  { k: ['pushdown', 'extension tricep', 'extensiones tricep', 'tricep polea', 'jalon tricep'], m: 'Tríceps (cabeza lateral y medial)', w: 'Aísla el tríceps con tensión constante de polea. Ideal para rematar tras los presses sin cargar hombro.' },
  { k: ['overhead extension', 'extension sobre cabeza', 'frances', 'extension tricep barra', 'skull'], m: 'Tríceps (cabeza larga)', w: 'El único tríceps que estira la cabeza larga (la más grande) en máximo estiramiento — donde más crecimiento se logra. Imprescindible para brazos gruesos.' },
  { k: ['dominadas', 'pull up', 'pull-up', 'pullup'], m: 'Dorsal ancho · bíceps · trapecio inferior', w: 'Aducción de hombro = amplitud del dorsal. No es intercambiable con el remo (plano opuesto): haz ambos.' },
  { k: ['jalon', 'jalón', 'pulldown', 'jalon al pecho', 'lat pulldown'], m: 'Dorsal ancho · bíceps · redondo mayor', w: 'Mismo patrón vertical que la dominada pero con carga graduable; construye la amplitud/ "alas" de la espalda.' },
  { k: ['remo con barra', 'remo barra', 'barbell row', 'remo pendlay'], m: 'Dorsal · trapecio medio · romboides · bíceps', w: 'Extensión de hombro = grosor y espalda alta. Plano horizontal, opuesto al jalón: los necesitas a los dos.' },
  { k: ['remo', 'row', 'remo mancuerna', 'remo polea', 'remo maquina', 'seal row'], m: 'Dorsal · trapecio medio · romboides · deltoides posterior', w: 'Con retracción escapular marcada cargas traps/romboides/rear delt; sin retracción (llevando solo el codo al torso) aíslas el dorsal para grosor. Mismo movimiento, distinto énfasis.' },
  { k: ['curl con barra', 'curl barra', 'curl de biceps', 'barbell curl'], m: 'Bíceps (ambas cabezas) · braquial', w: 'La mayor carga para el bíceps en su función principal (flexión con supinación). Base del volumen directo de brazo.' },
  { k: ['curl martillo', 'hammer', 'martillo'], m: 'Braquial · braquiorradial · bíceps', w: 'El agarre neutro carga el braquial (debajo del bíceps) y el braquiorradial: empuja el bíceps hacia arriba y engrosa el antebrazo.' },
  { k: ['curl inclinado', 'incline curl', 'curl predicador', 'preacher'], m: 'Bíceps (cabeza larga en estiramiento)', w: 'El brazo detrás del cuerpo estira la cabeza larga: más estímulo en la zona donde el curl normal afloja.' },
  { k: ['sentadilla', 'squat', 'sentadilla libre'], m: 'Cuádriceps · glúteo · aductores · core', w: 'El ejercicio de pierna con más carga total. El cuádriceps se recupera rápido y tolera bien el volumen y la frecuencia.' },
  { k: ['prensa', 'leg press', 'prensa 45'], m: 'Cuádriceps · glúteo', w: 'Permite acumular volumen de cuádriceps con menos fatiga sistémica y de core que la sentadilla libre. Buen segundo movimiento.' },
  { k: ['peso muerto rumano', 'rumano', 'rdl', 'sldl', 'peso muerto piernas rigidas'], m: 'Femoral (isquiotibiales) · glúteo · espalda baja', w: 'Estira el femoral bajo carga = gran estímulo de una zona que suele quedar corta de volumen. ⚠ Nunca al fallo (máx RIR 1): la espalda baja es zona de riesgo.' },
  { k: ['peso muerto', 'deadlift', 'peso muerto convencional'], m: 'Cadena posterior completa · dorsal · trapecio · glúteo · femoral', w: 'Ejercicio de fuerza total del cuerpo. ⚠ Zona lumbar cargada: deja siempre 1-2 reps en reserva, nunca RIR 0.' },
  { k: ['extensiones de cuadriceps', 'extension cuadriceps', 'leg extension', 'extensiones cuadriceps'], m: 'Cuádriceps (aislado, recto femoral)', w: 'Aísla el cuádriceps y lo lleva al fallo sin que la espalda o el core limiten. Ideal para rematar pierna.' },
  { k: ['curl femoral', 'femoral', 'leg curl', 'curl de pierna'], m: 'Femoral (isquiotibiales) · gemelo', w: 'Trabaja la otra función del femoral (flexión de rodilla) que el rumano no cubre. El femoral suele necesitar más volumen del que se le da.' },
  { k: ['gemelos', 'pantorrilla', 'calf', 'elevacion de gemelos', 'elevacion talones'], m: 'Gemelo · sóleo', w: 'Recuperación muy rápida: tolera frecuencia y volumen altos. Pausa en el estiramiento máximo para máximo estímulo.' },
  { k: ['crunch', 'abdominales', 'abs', 'crunch polea', 'rueda abdominal'], m: 'Recto abdominal · oblicuos', w: 'Con carga progresiva (polea) el abdomen se entrena como cualquier músculo. Los abs visibles son sobre todo cuestión de % de grasa.' },
  { k: ['hip thrust', 'empuje de cadera'], m: 'Glúteo mayor · femoral', w: 'Máxima tensión del glúteo en su punto de contracción pico, con poca demanda de espalda baja. El mejor aislamiento de glúteo.' },
  { k: ['zancadas', 'desplantes', 'lunge', 'bulgaras', 'bulgara', 'split squat'], m: 'Cuádriceps · glúteo · aductores', w: 'Trabajo unilateral: corrige asimetrías y carga el glúteo en estiramiento. Alta demanda de estabilidad.' },
  { k: ['face pull'], m: 'Deltoides posterior · manguito rotador · trapecio', w: 'Salud de hombro y postura. Volumen "gratis" para rear delt que equilibra tanto press horizontal.' },
];

export function exInfo(name) {
  const n = norm(name); let best = null, len = 0;
  for (const e of EXDB) for (const kw of e.k) { const nk = norm(kw); if (n.includes(nk) && nk.length > len) { best = e; len = nk.length; } }
  return best;
}

export const LOWBACK = ['rumano', 'rdl', 'sldl', 'peso muerto', 'buenos dias', 'good morning', 'hiperext', 'rigidas'];
export const isLowerBackLift = name => { const n = norm(name); return LOWBACK.some(k => n.includes(k)); };

/** Esquema RIR: solo el último set al fallo; RDL/espalda baja máx RIR 1 */
export function rirScheme(nSets, name) {
  const cap = isLowerBackLift(name) ? 1 : 0;
  return Array.from({ length: Math.max(1, nSets) }, (_, i) => cap + (nSets - 1 - i));
}

// --- sessionMaxW/progressionWarn (index.html "Alerta de progresión doble")
// — a diferencia de todo lo de arriba, estas SÍ dependen de S.sessions
// (historial real de entrenamiento). Se agregan al mismo archivo que
// EXDB/exInfo/rirScheme/isLowerBackLift para no duplicarlos (ver nota de
// cabecera y ruling de docs/superpowers/plans/2026-08-23-rn-completar-hoy.md).
export function sessionMaxW(session, name) {
  const e = (session.entries || []).find(en => norm(en.name) === norm(name));
  if (!e || !e.sets.length) return null;
  return Math.max(...e.sets.map(s => s.w));
}

export function progressionWarn(name, w) {
  const hist = S.sessions.map(s => sessionMaxW(s, name)).filter(x => x != null); // desc por fecha
  if (hist.length < 2) return null;
  const last = hist[0], prev = hist[1];
  if (last > prev + 0.01 && w < last - 0.01)
    return `Subiste a ${fmtNum(round1(last))} kg la última vez. No vuelvas atrás: quédate en ${fmtNum(round1(last))} y reconstruye reps (caer a 5-6 es normal y esperado).`;
  return null;
}
