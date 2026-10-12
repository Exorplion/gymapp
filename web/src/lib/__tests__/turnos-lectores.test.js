// Sesiones y lectores por turno: la segunda aparición de Posterior sabe lo
// que hiciste en la primera, y lo que lista turnos los dice una vez.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { startSession, completeSession, registrarDiaEntrenado } from '../session.js';
import { ultimaVezDeTurno, minutosDeTurno, turnosDeEjercicio, turnosComunes } from '../entreno.js';
import { daySessions, routineStability, copyExercises, turnoDeSesion } from '../rutina-logic.js';
import { opcionesDescanso } from '../descansoHoy.js';
import { arrancar, HOY } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../backup.js', async orig => ({ ...(await orig()), exportJSON: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../notify.js', async orig => ({ ...(await orig()), pedirPermiso: vi.fn() }));

// Una sesión de ANTES de los turnos: sólo slotId (la del martes, slot s1).
const vieja = {
  id: 'v1', date: '2026-10-06', slotId: 's1', dayName: 'Posterior', start: 1, end: 2, duration: 52,
  entries: [{ exId: 'p1', name: 'Curl femoral', sets: [{ w: 40, r: 10 }] }, { exId: 'p2', name: 'Remo', sets: [{ w: 50, r: 10 }] }],
};

describe('lectores por turno', () => {
  beforeEach(() => arrancar(undefined, { sessions: [vieja] }));

  it('la segunda aparición ve la última vez y los minutos de la primera (sesión vieja sin turnoId)', () => {
    expect(ultimaVezDeTurno(S.routine[4])).toBe('2026-10-06');
    expect(minutosDeTurno(S.routine[4])).toBe(50);
    expect(ultimaVezDeTurno(S.routine[3])).toBeNull();   // Anterior: nunca
  });

  it('daySessions y routineStability son del turno', () => {
    expect(daySessions('s4').map(s => s.id)).toEqual(['v1']);
    expect(routineStability('s4')).toEqual({ sessions: 1, last: '2026-10-06' });
  });

  it('turnoDeSesion resuelve la sesión vieja por su slot', () => {
    expect(turnoDeSesion(vieja)).toBe(S.turnos.find(t => t.name === 'Posterior'));
  });

  it('en un descanso, cada turno aparece UNA vez y el primero es el que sigue', () => {
    const o = opcionesDescanso({ routine: S.routine, seqIndex: 2, sessions: S.sessions, hoy: HOY });
    expect(o.opciones.map(x => [x.nombre, x.index])).toEqual([['Anterior', 3], ['Posterior', 4]]);
    expect(o.recomendado.nombre).toBe('Anterior');
    expect(o.opciones[1].dias).not.toBeNull();   // Posterior: la última vez sale de la sesión del slot s1
  });

  it('turnosDeEjercicio y turnosComunes no repiten el turno', () => {
    expect(turnosDeEjercicio('Remo').map(t => t.name)).toEqual(['Posterior']);
    expect(turnosComunes(['Remo', 'Curl femoral']).map(t => t.name)).toEqual(['Posterior']);
  });

  it('copiar entre dos apariciones del mismo turno es copiar sobre sí mismo', async () => {
    expect(await copyExercises({ fromIndex: 1 }, 4, ['p1'], 'merge')).toEqual({ copied: 0, reason: 'same' });
    expect(await copyExercises({ fromId: 's0' }, 's3', ['a1'], 'merge')).toEqual({ copied: 0, reason: 'same' });
  });
});

describe('las sesiones nuevas guardan turnoId', () => {
  beforeEach(() => arrancar());

  it('el borrador y la sesión cerrada llevan slotId y turnoId', async () => {
    const t = S.routine[4].turnoId;
    await startSession(4);
    expect(S.draft).toMatchObject({ slotId: 's4', turnoId: t });
    S.draft.entries = { p1: { name: 'Curl femoral', sets: [{ w: 40, r: 10 }] } };
    S.draft.start = Date.now() - 60000;
    await completeSession();
    expect(S.sessions[0]).toMatchObject({ slotId: 's4', turnoId: t });
    // y la primera aparición ya sabe que lo hiciste hoy
    expect(ultimaVezDeTurno(S.routine[1])).toBe(HOY);
  });

  it('un día pasado anotado a mano también', async () => {
    const s = await registrarDiaEntrenado('2026-10-01', 's1');
    expect(s.turnoId).toBe(S.routine[1].turnoId);
  });
});

describe('modo viejo (sin turnos): todo como antes', () => {
  it('cada slot es su propio turno', async () => {
    await arrancar(undefined, { sessions: [vieja], draft: { id: 'd', slotId: 's0', entries: {}, order: [] } });
    expect(S.turnos).toBeNull();
    expect(ultimaVezDeTurno(S.routine[4])).toBeNull();
    expect(ultimaVezDeTurno(S.routine[1])).toBe('2026-10-06');
    const o = opcionesDescanso({ routine: S.routine, seqIndex: 2, sessions: S.sessions, hoy: HOY });
    expect(o.opciones).toHaveLength(4);
    expect(turnosDeEjercicio('Remo')).toHaveLength(2);
  });
});
