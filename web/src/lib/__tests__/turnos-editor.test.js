// Plantillas, vaciar, deshacer y reordenar con turnos universales.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { esVinculado } from '../turnos.js';
import { saveExercise, undoRutina, redoRutina, applyWorkoutOrder, deleteExercise } from '../rutina-logic.js';
import { applyTemplate } from '../templates.js';
import { arrancar, recargar, disco, filasCompatibles } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const nombres = () => S.routine.map(s => (s.type === 'rest' ? 'R' : s.name[0]));

describe('applyDays agrupa por nombre', () => {
  beforeEach(async () => {
    await arrancar([], { lib: [{ id: 'mia', name: 'Mía', days: [{ type: 'workout', name: 'X', exercises: [] }], savedAt: '2026-01-01' }] });
    await applyTemplate('antpost');
  });

  it('la plantilla A·P·R·A·P·R·R crea DOS turnos, y las apariciones quedan vinculadas', async () => {
    expect(nombres()).toEqual(['A', 'P', 'R', 'A', 'P', 'R', 'R']);
    expect(S.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(S.routine[0].exercises).toBe(S.routine[3].exercises);
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
    const d = await disco();
    expect(d.settings.turnos).toHaveLength(2);
    expect(filasCompatibles(d)).toBe(true);
    expect(d.settings.lib.map(x => x.name)).toEqual(['Mía']);   // la biblioteca no se toca
    // y al recargar no hay nada que reconciliar: sin respaldo ni aviso
    await recargar();
    expect(S.cfg.avisoTurnos).toBeUndefined();
    expect(S.lib).toHaveLength(1);
  });

  it('volver a aplicar una plantilla reemplaza los turnos (no se acumulan)', async () => {
    await applyTemplate('antpost');   // la rutina ya tiene ejercicios: pide confirmación
    S.sheet?.props?.onConfirm?.();
    await vi.waitFor(() => expect(S.sheet?.type).not.toBe('confirm'));
    await vi.waitFor(async () => expect((await disco()).settings.turnos).toHaveLength(2));
    expect(S.turnos).toHaveLength(2);
  });
});

describe('deshacer con turnos', () => {
  beforeEach(() => arrancar());

  it('deshacer una edición de Posterior la vuelve en las dos apariciones, y siguen vinculadas', async () => {
    await deleteExercise(4, 'p2');
    expect(S.routine[1].exercises.map(e => e.name)).toEqual(['Curl femoral']);
    await undoRutina();
    expect(S.routine[1].exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo']);
    expect(S.routine[4].exercises).toBe(S.routine[1].exercises);
    expect(esVinculado(S.routine[4])).toBe(true);
    let d = await disco();
    expect(d.routine[4].exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo']);
    expect(filasCompatibles(d)).toBe(true);

    await redoRutina();
    expect(S.routine[4].exercises.map(e => e.name)).toEqual(['Curl femoral']);
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
    // y después de deshacer, editar sigue llegando a las dos
    await undoRutina();
    await saveExercise(1, 'p1', { name: 'Curl femoral', sets: 2, reps: 12 });
    expect(S.routine[4].exercises[0].reps).toBe(12);
    d = await disco();
    expect(d.routine[4].exercises[0].reps).toBe(12);
  });
});

describe('applyWorkoutOrder recalcula los descansos (nota de la spec)', () => {
  it('mover un turno sobre A·P·R·A·P·R·R deja A·R·P·R·A·R·P (los descansos se regeneran por pierna)', async () => {
    await arrancar([]);
    await applyTemplate('antpost');
    const ids = S.routine.filter(s => s.type === 'workout').map(s => s.id);
    await applyWorkoutOrder(ids);   // el mismo orden: alcanza con recalcular
    expect(nombres()).toEqual(['A', 'R', 'P', 'R', 'A', 'R', 'P']);
    // los slots siguen vinculados a sus dos turnos
    expect(S.routine[0].exercises).toBe(S.routine[4].exercises);
    expect(filasCompatibles(await disco())).toBe(true);
  });
});

describe('vaciar el split', () => {
  it('startBlank deja la secuencia y los turnos vacíos, en disco también', async () => {
    await arrancar();
    const { startBlank } = await import('../rutina-logic.js');
    startBlank();
    await S.sheet.props.onConfirm();
    expect(S.routine).toEqual([]);
    expect(S.turnos).toEqual([]);
    const d = await disco();
    expect(d.routine).toEqual([]);
    expect(d.settings.turnos).toEqual([]);
  });
});
