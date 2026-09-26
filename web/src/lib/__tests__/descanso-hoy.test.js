import { describe, it, expect } from 'vitest';
import { opcionesDescanso } from '../descansoHoy.js';

/* "Entrenar igual" en un día de descanso (Enzo, 2026-09-25): la pantalla
   tiene que decir qué hiciste por última vez, cuánto descansaste y qué te
   toca, y dejarte elegir cualquier turno — nunca mandarte a configurar una
   rutina que ya está armada. */

const ej = [{ id: 'x', name: 'Algo', sets: 3, reps: 10 }];
const RUTINA = [
  { id: 'aA', type: 'workout', name: 'Anterior A', exercises: ej },
  { id: 'pA', type: 'workout', name: 'Posterior A', exercises: ej },
  { id: 'd1', type: 'rest' },
  { id: 'aB', type: 'workout', name: 'Anterior B', exercises: ej },
  { id: 'pB', type: 'workout', name: 'Posterior B', exercises: ej },
  { id: 'd2', type: 'rest' },
  { id: 'd3', type: 'rest' },
];
const SESIONES = [
  { id: '1', date: '2026-09-18', slotId: 'aB' },
  { id: '2', date: '2026-09-19', slotId: 'pB' },
  { id: '3', date: '2026-09-21', slotId: 'aA' },
  { id: '4', date: '2026-09-24', slotId: 'pA' },
];

describe('opcionesDescanso', () => {
  const r = opcionesDescanso({ routine: RUTINA, seqIndex: 2, sessions: SESIONES, hoy: '2026-09-25' });

  it('dice cuál fue el último entrenamiento y cuántos días de descanso van', () => {
    expect(r.ultimo).toEqual({ nombre: 'Posterior A', dias: 1 });
    expect(r.diasDescanso).toBe(0);
  });

  it('recomienda el turno que sigue en la secuencia, y dice cuál viene después', () => {
    expect(r.recomendado.nombre).toBe('Anterior B');
    expect(r.recomendado.index).toBe(3);
    expect(r.despues).toBe('Posterior B');
  });

  it('lista todos los turnos de entrenamiento: el recomendado primero, el resto en el orden de la secuencia', () => {
    expect(r.opciones.map(o => o.nombre)).toEqual(['Anterior B', 'Posterior B', 'Anterior A', 'Posterior A']);
    expect(r.opciones.map(o => o.dias)).toEqual([7, 6, 4, 1]);
  });

  it('marca como reciente el que hiciste ayer (repetirlo no deja descansar esos músculos)', () => {
    expect(r.opciones.find(o => o.nombre === 'Posterior A').reciente).toBe(true);
    expect(r.opciones.filter(o => o.reciente)).toHaveLength(1);
  });

  it('da la vuelta a la secuencia cuando el descanso está al final', () => {
    const f = opcionesDescanso({ routine: RUTINA, seqIndex: 6, sessions: SESIONES, hoy: '2026-09-25' });
    expect(f.recomendado.nombre).toBe('Anterior A');
    expect(f.despues).toBe('Posterior A');
  });

  it('un turno nunca hecho no inventa días', () => {
    const s = opcionesDescanso({ routine: RUTINA, seqIndex: 2, sessions: [], hoy: '2026-09-25' });
    expect(s.ultimo).toBeNull();
    expect(s.diasDescanso).toBeNull();
    expect(s.opciones.every(o => o.dias === null && !o.reciente)).toBe(true);
  });

  it('ignora turnos sin ejercicios', () => {
    const vacia = RUTINA.map(t => (t.id === 'aB' ? { ...t, exercises: [] } : t));
    const v = opcionesDescanso({ routine: vacia, seqIndex: 2, sessions: SESIONES, hoy: '2026-09-25' });
    expect(v.recomendado.nombre).toBe('Posterior B');
    expect(v.opciones).toHaveLength(3);
  });

  it('dos días sin entrenar cuentan como dos días de descanso', () => {
    const d = opcionesDescanso({ routine: RUTINA, seqIndex: 2, sessions: SESIONES, hoy: '2026-09-27' });
    expect(d.ultimo.dias).toBe(3);
    expect(d.diasDescanso).toBe(2);
  });
});
