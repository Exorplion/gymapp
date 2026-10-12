// "¿Le sacás foto a esta máquina?" en el descanso (Enzo, 2026-10-12).
//
// El botón de la foto vivía en el menú ⋯ ("En qué máquina") y alguien que
// empieza no entiende para qué sirve. La foto es lo que separa el progreso de
// una máquina del de otra (lib/maquinas.js): se ofrece en el momento en que
// tiene sentido — el descanso después de la PRIMERA serie de un ejercicio de
// máquina sin foto — con el porqué en una línea.
//
// Aviso raro, no diario (CLAUDE.md): "Ahora no" no vuelve a preguntar por ese
// ejercicio, y si la pregunta se ignora dos veces tampoco.
//
// Lo que se guarda: S.cfg.fotoPreg[ejercicio] = 'no' | 'hecha' | n (veces que
// se mostró sin respuesta).
import { S, saveCfg } from './state.js';
import { isMachineBound } from './equip.js';
import { keyEj, maquinasDe } from './maquinas.js';

export const VECES_SIN_RESPUESTA = 2;

/** ¿Toca ofrecer la foto en el descanso de esta serie? Sin mirar la foto
    guardada (eso es asíncrono, lo resuelve quien llama con getPhoto).
    `idx` es la fila recién anotada; en unilateral la primera serie completa
    es la fila 1 (izquierda + derecha). */
export function tocaOfrecerFoto(ex, idx, { uni = false, gymId = S.cfg?.activeGym, cfg = S.cfg } = {}) {
  if (!ex || !isMachineBound(ex.equip)) return false;
  if (idx !== (uni ? 1 : 0)) return false;
  const r = cfg?.fotoPreg?.[keyEj(ex.name)];
  if (r === 'no' || r === 'hecha' || (typeof r === 'number' && r >= VECES_SIN_RESPUESTA)) return false;
  // Si ya armó máquinas para este ejercicio en este gym, ya sabe para qué es.
  if (gymId && maquinasDe(gymId, ex.name).length) return false;
  return true;
}

async function marcar(exName, valor) {
  if (!S.cfg.fotoPreg) S.cfg.fotoPreg = {};
  S.cfg.fotoPreg[keyEj(exName)] = valor;
  await saveCfg();
}

/** Se mostró la pregunta (cuenta para el tope de VECES_SIN_RESPUESTA). */
export function fotoOfrecida(exName) {
  const prev = S.cfg.fotoPreg?.[keyEj(exName)];
  return marcar(exName, (typeof prev === 'number' ? prev : 0) + 1);
}
export const fotoRechazada = exName => marcar(exName, 'no');
export const fotoHecha = exName => marcar(exName, 'hecha');
