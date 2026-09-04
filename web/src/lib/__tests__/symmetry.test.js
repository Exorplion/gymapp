import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { sideImbalance } from '../symmetry.js';

const ex = { name: 'Press militar mancuerna' };

function sessionWith(sets) {
  return { entries: [{ name: ex.name, sets }] };
}

describe('sideImbalance', () => {
  beforeEach(() => { S.sessions = []; });

  it('sin datos de sesiones, devuelve null (no inventa un 0)', () => {
    expect(sideImbalance(ex)).toBeNull();
  });

  it('con series pero sin lado registrado, devuelve null', () => {
    S.sessions = [sessionWith([{ w: 20, r: 10 }, { w: 20, r: 10 }])];
    expect(sideImbalance(ex)).toBeNull();
  });

  it('con datos de un solo lado, devuelve null', () => {
    S.sessions = [
      sessionWith([{ w: 20, r: 10, side: 'left' }]),
      sessionWith([{ w: 20, r: 10, side: 'left' }]),
      sessionWith([{ w: 20, r: 10, side: 'left' }]),
    ];
    expect(sideImbalance(ex)).toBeNull();
  });

  it('menos de 3 sesiones comparables, devuelve null aunque la diferencia sea grande', () => {
    S.sessions = [
      sessionWith([{ w: 10, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 10, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
    ];
    expect(sideImbalance(ex)).toBeNull();
  });

  it('diferencia sostenida bajo el umbral (12%), no avisa', () => {
    S.sessions = [
      sessionWith([{ w: 19, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 19, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 19, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
    ];
    expect(sideImbalance(ex)).toBeNull();
  });

  it('diferencia sostenida sobre el umbral, avisa con el lado más fuerte y el %', () => {
    S.sessions = [
      sessionWith([{ w: 16, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 16, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 16, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
    ];
    const res = sideImbalance(ex);
    expect(res).not.toBeNull();
    expect(res.strongerSide).toBe('right');
    expect(res.pct).toBe(20);
  });

  it('una sola sesión desbalanceada entre varias parejas no dispara el aviso (no es ruido de un día)', () => {
    S.sessions = [
      sessionWith([{ w: 16, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 20, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
      sessionWith([{ w: 20, r: 10, side: 'left' }, { w: 20, r: 10, side: 'right' }]),
    ];
    expect(sideImbalance(ex)).toBeNull();
  });
});
