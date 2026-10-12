// "Entrenar igual" en un día de descanso (Enzo, 2026-09-25). Antes Hoy caía
// en la tarjeta de "este turno no tiene ejercicios, configuralo en Rutina",
// que es para un turno de entrenamiento vacío: en un descanso parecía un
// error. Esto arma lo que la pantalla necesita decir en su lugar — qué
// hiciste por última vez, cuánto descansaste, cuál te toca — y las opciones
// para elegir cualquier turno.
//
// Puro (sin S): recibe rutina, puntero, sesiones y la fecha de hoy.
import { claveTurno, claveDeSesion } from './turnos.js';

/** Días calendario entre dos 'YYYY-MM-DD'. Al mediodía, para que el cambio
    de horario no corra el resultado un día (igual que diasEntre en state.js). */
function dias(desde, hasta) {
  const a = new Date(desde + 'T12:00:00'), b = new Date(hasta + 'T12:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function opcionesDescanso({ routine, seqIndex, sessions, hoy }) {
  const n = routine.length;
  const entrena = t => t?.type === 'workout' && t.exercises?.length;

  // Última fecha por turno (turnos universales: la clave del turno, así la
  // sesión de un Posterior cuenta para sus dos apariciones), y la última
  // sesión de todas.
  const ultimaDe = new Map();
  let ultima = null;
  for (const s of sessions) {
    if (!s?.date || s.date > hoy) continue;
    const k = claveDeSesion(s, routine);
    if (k && (!ultimaDe.has(k) || s.date > ultimaDe.get(k))) ultimaDe.set(k, s.date);
    if (!ultima || s.date > ultima.date) ultima = s;
  }

  // Los turnos de entrenamiento en el orden de la secuencia, empezando por
  // el primero que viene después del puntero: ése es el que te toca. Cada
  // turno UNA vez, en su próxima aparición: en A·P·R·A·P·R·R son dos
  // opciones, no cuatro.
  const orden = [];
  const vistos = new Set();
  for (let k = 0; k < n; k++) {
    const i = (seqIndex + k) % n;
    if (!entrena(routine[i]) || vistos.has(claveTurno(routine[i]))) continue;
    vistos.add(claveTurno(routine[i]));
    orden.push(i);
  }

  const opciones = orden.map((i, pos) => {
    const t = routine[i];
    const f = ultimaDe.get(claveTurno(t));
    const d = f ? dias(f, hoy) : null;
    return {
      index: i,
      id: t.id,
      nombre: t.name || 'Entrenamiento',
      dias: d,
      recomendado: pos === 0,
      // Ayer u hoy: esos músculos todavía no descansaron.
      reciente: pos !== 0 && d !== null && d <= 1,
    };
  });

  const ultimoTurno = ultima && routine.find(t => t.id === ultima.slotId);
  const diasUltimo = ultima ? dias(ultima.date, hoy) : null;
  return {
    ultimo: ultima ? { nombre: ultimoTurno?.name || ultima.dayName || 'Entrenamiento', dias: diasUltimo } : null,
    // Días enteros sin entrenar entre la última sesión y hoy.
    diasDescanso: diasUltimo === null ? null : Math.max(0, diasUltimo - 1),
    recomendado: opciones[0] || null,
    despues: opciones.length > 1 ? opciones[1].nombre : null,
    opciones,
  };
}

/** "Hoy hago otra cosa" (turnos universales, Fase 3): lo mismo que en un
    descanso, pero en un día de ENTRENAMIENTO no aparece el turno que tocaba
    (ya está en pantalla) y ninguno es "el recomendado": salirse del plan es
    tu decisión. En un descanso devuelve exactamente opcionesDescanso. */
export function opcionesDelDia(args) {
  const o = opcionesDescanso(args);
  const p = args.routine[args.seqIndex];
  if (p?.type !== 'workout') return o;
  const k = claveTurno(p);
  const opciones = o.opciones
    .filter(op => claveTurno(args.routine[op.index]) !== k)
    .map(op => ({ ...op, recomendado: false, reciente: op.dias !== null && op.dias <= 1 }));
  return { ...o, recomendado: null, despues: null, opciones };
}
