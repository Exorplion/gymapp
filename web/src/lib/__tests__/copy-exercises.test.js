import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { cloneExercise, copyExercises, routineSnapshot } from '../rutina-logic.js';

// copyExercises persiste con idb.put y avisa con toast; ninguno de los dos
// existe fuera del navegador, así que se anulan. Lo que se prueba acá es la
// transformación de S.routine, que es donde vive la lógica.
vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const ex = (id, name, extra = {}) => ({ id, name, sets: 3, reps: 10, ...extra });
const slot = (id, order, name, exs) => ({ id, order, type: 'workout', name, exercises: exs });

beforeEach(() => {
  S.routine = [
    slot('s0', 0, '', []),
    slot('s1', 1, 'Anterior A', [
      ex('a1', 'Press plano', { equip: 'discos', machine: 'Hammer' }),
      ex('a2', 'Press inclinado'),
      ex('a3', 'Pec deck', { equip: 'placas' }),
    ]),
    { id: 'r2', order: 2, type: 'rest' },
    slot('s3', 3, '', []),
    slot('s4', 4, 'Anterior B', [ex('b1', 'Pec deck', { equip: 'placas' })]),
    slot('s5', 5, '', []),
  ];
});

describe('cloneExercise', () => {
  it('conserva todo menos el id', () => {
    const src = ex('a1', 'Press plano', { equip: 'discos', machine: 'Hammer', illus: 'x.svg', photo: 'data:...' });
    const c = cloneExercise(src);
    expect(c.id).not.toBe('a1');
    expect(c.id).toBeTruthy();
    expect(c).toMatchObject({
      name: 'Press plano', sets: 3, reps: 10,
      equip: 'discos', machine: 'Hammer', illus: 'x.svg', photo: 'data:...',
    });
  });

  it('dos clones del mismo ejercicio no comparten id', () => {
    const src = ex('a1', 'Press plano');
    expect(cloneExercise(src).id).not.toBe(cloneExercise(src).id);
  });
});

describe('copyExercises', () => {
  it('en modo replace el destino queda con exactamente lo seleccionado', async () => {
    await copyExercises({ fromIndex: 1 }, 4, ['a1', 'a2'], 'replace');
    expect(S.routine[4].exercises.map(e => e.name)).toEqual(['Press plano', 'Press inclinado']);
  });

  it('en modo merge agrega sólo los que faltan', async () => {
    await copyExercises({ fromIndex: 1 }, 4, ['a1', 'a2', 'a3'], 'merge');
    // 'Pec deck · placas' ya estaba en el turno 4: no se duplica
    expect(S.routine[4].exercises.map(e => e.name)).toEqual(['Pec deck', 'Press plano', 'Press inclinado']);
  });

  it('el mismo nombre con otro equipo NO cuenta como repetido', async () => {
    S.routine[1].exercises.push(ex('a4', 'Pec deck', { equip: 'polea' }));
    await copyExercises({ fromIndex: 1 }, 4, ['a4'], 'merge');
    expect(S.routine[4].exercises).toHaveLength(2);
    expect(S.routine[4].exercises.map(e => e.equip)).toEqual(['placas', 'polea']);
  });

  it('las copias llevan ids nuevos y no pisan los del origen', async () => {
    await copyExercises({ fromIndex: 1 }, 5, ['a1', 'a2'], 'replace');
    const idsOrigen = S.routine[1].exercises.map(e => e.id);
    const idsDestino = S.routine[5].exercises.map(e => e.id);
    expect(idsDestino.some(id => idsOrigen.includes(id))).toBe(false);
    expect(new Set([...idsOrigen, ...idsDestino]).size).toBe(5);
  });

  it('conserva el equipamiento, que es lo que enlaza el historial', async () => {
    await copyExercises({ fromIndex: 1 }, 5, ['a1'], 'replace');
    expect(S.routine[5].exercises[0]).toMatchObject({ equip: 'discos', machine: 'Hammer' });
  });

  it('copiar a un turno vacío le deja el nombre del origen si no tenía', async () => {
    await copyExercises({ fromIndex: 1 }, 5, ['a1'], 'replace');
    expect(S.routine[5].name).toBe('Anterior A');
  });

  it('no le pisa el nombre a un turno que ya tenía uno', async () => {
    await copyExercises({ fromIndex: 1 }, 4, ['a1'], 'merge');
    expect(S.routine[4].name).toBe('Anterior B');
  });

  it('trae desde una rutina guardada', async () => {
    S.lib = [{
      id: 'r1', name: 'Vieja', savedAt: '2026-01-01',
      days: [
        { type: 'rest' },
        { type: 'workout', name: 'Pull', exercises: [{ name: 'Remo', sets: 4, reps: 8, equip: 'polea', machine: 'Cybex' }] },
      ],
    }];
    await copyExercises({ libId: 'r1', libIndex: 1 }, 5, ['Remo'], 'replace');
    expect(S.routine[5].exercises[0]).toMatchObject({ name: 'Remo', sets: 4, reps: 8, equip: 'polea', machine: 'Cybex' });
    expect(S.routine[5].exercises[0].id).toBeTruthy();
  });

  it('sin ejercicios seleccionados no toca nada', async () => {
    await copyExercises({ fromIndex: 1 }, 4, [], 'replace');
    expect(S.routine[4].exercises).toHaveLength(1);
  });

  it('copiar sobre sí mismo no hace nada', async () => {
    await copyExercises({ fromIndex: 1 }, 1, ['a1'], 'merge');
    expect(S.routine[1].exercises).toHaveLength(3);
  });
});

describe('routineSnapshot', () => {
  it('conserva el equipamiento — sin él la rutina guardada pierde su historial', () => {
    const snap = routineSnapshot();
    expect(snap[1].exercises[0]).toMatchObject({
      name: 'Press plano', sets: 3, reps: 10, equip: 'discos', machine: 'Hammer',
    });
  });

  it('no guarda la foto: son data-URLs y S.lib entero vive en un solo registro', () => {
    S.routine[1].exercises[0].photo = 'data:image/png;base64,AAAA';
    expect(routineSnapshot()[1].exercises[0].photo).toBeUndefined();
  });

  it('un turno de descanso se guarda como {type: "rest"}, sin exercises ni name', () => {
    const snap = routineSnapshot();
    expect(snap[2]).toEqual({ type: 'rest' });
  });
});
