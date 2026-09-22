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

/** El RIR que se le PIDE a una serie: un escalón del esquema, pero acotado a
    lo que la app efectivamente ofrece como respuesta (RIR_OPTS).

    Existe por dos razones, y las dos son del mismo tipo: prescribir un número
    que Enzo no puede contestar no es información, es ruido.
    - El índice se acota a los extremos del esquema. Una serie extra concedida
      a mano ("+ Serie") empuja el índice más allá del último escalón; ahí
      corresponde el último (el del fallo), no `undefined`.
    - El valor se acota al techo de la escala. Los chips son 0/1/2/3/4+, así
      que un "RIR 5" no tiene chip donde caer: se muestra como 4+, que es
      exactamente lo que ese balde significa ("cuatro o más en reserva").

    Lo que NO arregla esta función es el bug de raíz: si el esquema se armó
    sobre FILAS en vez de sobre series reales, el número sigue estando mal
    aunque caiga adentro de la escala. Por eso quien la llama tiene que
    pasarle un esquema armado sobre series reales — ver el comentario en
    ExerciseCarousel.jsx y en saveSet() de session.js. */
export function rirPedido(scheme, serieIdx) {
  if (!Array.isArray(scheme) || !scheme.length) return null;
  const i = Math.max(0, Math.min(serieIdx, scheme.length - 1));
  const n = scheme[i];
  return n == null ? null : Math.min(n, RIR_OPTS[RIR_OPTS.length - 1]);
}
