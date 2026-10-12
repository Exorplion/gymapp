// Lo que MUTA ejercicios recorre turnos, no slots: con ejercicios
// compartidos, recorrer slots toca el mismo objeto dos veces.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { applyDeload, endDeload } from '../rutina-logic.js';
import { setActiveGym } from '../gyms.js';
import { keyEj } from '../maquinas.js';
import { arrancar, recargar, disco, filasCompatibles } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));

describe('descarga sobre un turno que aparece dos veces', () => {
  beforeEach(() => arrancar());

  it('cada ejercicio baja UNA vez (4 → 2, no 4 → 2 → 1) y terminarla lo devuelve a 4', async () => {
    expect(await applyDeload(['Pierna'])).toBe(true);
    const hack = () => S.routine[3].exercises.find(e => e.name === 'Hack squat');
    expect(hack().sets).toBe(2);
    expect(S.routine[0].exercises.find(e => e.name === 'Hack squat').sets).toBe(2);
    expect(S.cfg.deload.antes[hack().id]).toBe(4);
    let d = await disco();
    expect(d.routine[3].exercises.find(e => e.name === 'Hack squat').sets).toBe(2);
    expect(filasCompatibles(d)).toBe(true);

    await recargar();   // la descarga dura días: sobrevive a cerrar la app
    expect(await endDeload()).toBe(true);
    expect(hack().sets).toBe(4);
    expect(S.routine[0].exercises.find(e => e.name === 'Hack squat').sets).toBe(4);
    d = await disco();
    expect(d.routine[0].exercises.find(e => e.name === 'Hack squat').sets).toBe(4);
    expect(d.routine[3].exercises.find(e => e.name === 'Hack squat').sets).toBe(4);
  });
});

describe('gimnasio activo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('setActiveGym guarda una vez por turno, aunque el de hoy aparezca dos veces', async () => {
    await arrancar(undefined, { cfg: { seqIndex: 1 } });   // hoy toca Posterior
    S.gyms = [{
      id: 'g', name: 'Smart', equip: { remo: { equip: 'polea' } },
      maquinas: { [keyEj('Remo')]: [{ id: 'm1', nombre: 'Polea baja' }] },
      ultimaMaquina: { [keyEj('Remo')]: 'm1' },
    }];
    const tx = vi.spyOn(idb, 'tx');
    await setActiveGym('g');
    expect(tx).toHaveBeenCalledTimes(1);
    const remo = S.routine[4].exercises.find(e => e.name === 'Remo');
    expect(remo).toMatchObject({ equip: 'polea', varianteNombre: 'Polea baja' });
    const d = await disco();
    expect(d.routine[1].exercises.find(e => e.name === 'Remo').varianteNombre).toBe('Polea baja');
    expect(filasCompatibles(d)).toBe(true);
  });
});
