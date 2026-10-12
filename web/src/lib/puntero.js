// El puntero de la semana (S.cfg.seqIndex): qué te toca. Turnos universales,
// Fase 3 (spec 2026-10-12, §5, opción A que eligió Enzo).
//
// Regla: si hacés algo fuera del plan, la semana SIGUE como estaba. El día
// cuenta como usado y el plan no se corre. Lunes Anterior; el martes tocaba
// Posterior y fue Pull con un amigo; miércoles descanso, jueves Anterior y
// viernes Posterior, como estaba.
//
//   pendiente al abrir | qué hiciste                  | puntero al cerrar
//   entreno T          | T                            | el siguiente a T
//   entreno T          | otro turno U o sesión libre  | el siguiente a T (el día se usó)
//   descanso           | el que sigue ("Adelantar")   | el siguiente a ése (como siempre)
//   descanso           | otro turno o sesión libre    | no se mueve: el descanso se consume por fecha
//
// `seqIndexDate` es el día PARA el que está pendiente el slot del puntero.
// Al cerrar una sesión el próximo slot es de MAÑANA: antes se guardaba la
// fecha de hoy, y al día siguiente resolveAutoRest (state.js) ya consumía el
// descanso que venía. Con A·P·R·A·P·R·R, después del Posterior del martes el
// miércoles mostraba Anterior en vez de descanso.
//
// Puro: recibe la rutina y la cfg.
import { claveTurno } from './turnos.js';

/** 'YYYY-MM-DD' del día siguiente (al mediodía: el horario de verano no
    corre la fecha). */
export function manana(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Avanza el puntero un lugar desde `desde`, terminado el día `fecha`. Si
    da la vuelta a la semana suma 1 a `cfg.ciclo` (la vuelta en la que vas;
    la usa "en vez de…" y, en la Fase 4, la compensación). */
export function avanzarPuntero(cfg, n, desde, fecha) {
  if (!n || desde < 0) return;
  const sig = (desde + 1) % n;
  if (sig <= desde) cfg.ciclo = (cfg.ciclo || 0) + 1;
  cfg.seqIndex = sig;
  cfg.seqIndexDate = manana(fecha);
}

/** El primer slot de entrenamiento desde `seq` (incluido), o -1. */
function primerEntreno(routine, seq) {
  const n = routine.length;
  for (let k = 0; k < n; k++) {
    const i = (seq + k) % n;
    if (routine[i]?.type === 'workout') return i;
  }
  return -1;
}

/**
 * Cómo entra en el plan una sesión que se abre HOY con el turno `index`
 * (-1 = sesión libre). Lo que devuelve va al borrador:
 *  - { slotIndex }: dentro del plan; `slotIndex` es la parada que se cumple
 *    (la pendiente, o "la que sigue" en un descanso), aunque hayas elegido
 *    otra aparición del mismo turno.
 *  - { fueraDePlan: true, reemplaza }: `reemplaza` es lo que tocaba
 *    ({ slotId, turnoId, nombre, ciclo }) o null si tocaba descanso.
 */
export function planDeLaSesion({ routine, seqIndex, index, ciclo = 0 }) {
  const p = routine[seqIndex];
  const elegido = index >= 0 ? routine[index] : null;
  const clave = elegido?.type === 'workout' ? claveTurno(elegido) : null;
  if (!p) return { slotIndex: index };
  if (p.type === 'workout') {
    if (clave && claveTurno(p) === clave) return { slotIndex: seqIndex };
    return { fueraDePlan: true, reemplaza: { slotId: p.id, turnoId: claveTurno(p), nombre: p.name || '', ciclo } };
  }
  const sig = primerEntreno(routine, seqIndex);
  if (clave && sig >= 0 && claveTurno(routine[sig]) === clave) return { slotIndex: sig };
  return { fueraDePlan: true, reemplaza: null };
}

/** Desde qué parada avanza el puntero al cerrar la sesión `draft`, o null si
    no se mueve (fuera del plan en un descanso). Borradores de antes de la
    Fase 3 no tienen `fueraDePlan`: avanzan desde su slot, como siempre. */
export function desdeAlCerrar({ routine, draft }) {
  const idx = id => (id ? routine.findIndex(s => s.id === id) : -1);
  if (draft?.fueraDePlan) {
    const i = idx(draft.reemplaza?.slotId);
    return i >= 0 ? i : null;
  }
  const i = idx(draft?.slotId);
  return i >= 0 ? i : null;
}
