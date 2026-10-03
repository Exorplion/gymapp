// El turno al que miran la tarjeta de recuperación de Inicio y el mapa "Tu
// cuerpo" (2026-10-03).
//
// Enzo: "hoy me toca posterior, entonces me gustaría saber cómo van mis
// músculos de posterior, pero sólo muestra cuatro". La tarjeta mostraba los
// cuatro MÁS CARGADOS, que en un día de posterior suelen ser los de la
// anterior de ayer. Ahora primero va lo del turno que toca.
import { S, esDiaLibre } from './state.js';
import { dstr } from './format.js';
import { pendingSlot, sesionDeHoy } from './session.js';
import { zonasDeTurno } from './recuperacion.js';

const esTurno = s => s?.type === 'workout' && s.exercises?.length > 0;

/** El turno de entrenamiento que sigue al índice dado, dando la vuelta. */
export function siguienteTurno(desde) {
  const n = S.routine.length;
  for (let k = 1; k <= n; k++) {
    const s = S.routine[(desde + k) % n];
    if (esTurno(s)) return s;
  }
  return null;
}

/** `{ slot, cuando: 'hoy' | 'proximo', zonas }`, o null sin rutina.

    - Entrenando ahora: el turno en curso, "hoy".
    - Sin entrenar todavía, con turno y sin marcar el día libre: ese, "hoy".
    - Ya entrenaste, es descanso o lo marcaste libre: el próximo turno. La
      secuencia ya avanzó al terminar, así que pendingSlot() ES el próximo
      (si es un descanso, el turno de después). */
export function turnoFoco() {
  const con = (slot, cuando) => {
    const zonas = zonasDeTurno(slot);
    return zonas.length ? { slot, cuando, zonas } : null;
  };
  if (S.draft) {
    const enCurso = S.routine.find(x => x.id === S.draft.slotId);
    if (esTurno(enCurso)) return con(enCurso, 'hoy');
  }
  const slot = pendingSlot();
  if (!sesionDeHoy() && esTurno(slot) && !esDiaLibre(dstr())) return con(slot, 'hoy');
  const prox = esTurno(slot) ? slot : siguienteTurno(S.cfg.seqIndex ?? 0);
  return prox ? con(prox, 'proximo') : null;
}
