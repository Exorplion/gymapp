// RIR ↔ RPE: la app entera prescribe en RIR (Rutina.jsx, DayPeek.jsx,
// ExInfo.jsx, la línea "Objetivo … → RIR N" de la tarjeta del ejercicio) pero
// abajo se preguntaba en RPE, la escala INVERTIDA (RPE 10 = RIR 0).
// Enzo: "eso del esfuerzo no sé usarlo" — tenía razón, eran dos idiomas
// distintos en la misma pantalla. Convertimos sólo en la capa de UI: el
// campo que se guarda en cada serie sigue siendo `rpe` (hay historial real
// con ese campo, y el precedente de este repo es no migrar sesiones, ver
// lib/db.js) — rir = 10 - rpe, rpe = 10 - rir.
//
// Esto vivía dentro de ExerciseCarousel.jsx, junto al <details> "Más
// opciones". Se mudó acá cuando la pregunta pasó al overlay de descanso
// (RestTimer.jsx) y el parcheo de la serie ya guardada pasó a session.js:
// tres consumidores, una sola definición. La semántica no cambió ni un
// gramo — son exactamente las mismas funciones.
export const RIR_OPTS = [0, 1, 2, 3, 4];

export function rirFromRpe(rpe) {
  if (rpe == null) return null;
  const rir = 10 - rpe;
  return rir >= 4 ? 4 : Math.max(0, rir);
}

// "4+" es un balde: cualquier rpe <=6 (histórico o nuevo) cae ahí. Se elige
// 6 como valor guardado porque es el techo exacto de ese balde (10-4=6) — un
// rpe viejo de 5 o 3 se sigue leyendo "4+" sin tocarlo, nunca se migra.
export function rpeFromRir(rir) { return rir >= 4 ? 6 : 10 - rir; }

/** El rótulo del chip. 0 y 4 no son números sueltos: son los dos extremos
    de la escala y hay que decir qué significan, o "0" se lee como "no sé". */
export function rirLabel(n) { return n === 4 ? '4+' : n === 0 ? '0 (al fallo)' : String(n); }
