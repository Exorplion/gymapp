import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fotos en memoria: el store 'gymPhotos' de IndexedDB, de mentira.
const fotos = new Map();
vi.mock('../db.js', () => ({
  idb: {
    put: vi.fn(async (store, row) => { if (store === 'gymPhotos') fotos.set(row.id, row); }),
    get: vi.fn(async (store, id) => (store === 'gymPhotos' ? fotos.get(id) || null : null)),
    del: vi.fn(async (store, id) => { if (store === 'gymPhotos') fotos.delete(id); }),
    all: vi.fn(async () => []), clear: vi.fn(),
  },
}));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../photo.js', () => ({ shrinkImageBlob: vi.fn(async f => f) }));
vi.mock('../rutina-logic.js', () => ({ persistSlot: vi.fn() }));

const { S } = await import('../state.js');
const { exKey } = await import('../equip.js');
const { aplicarMaquina, nombreConMaquina, maquinasDe } = await import('../maquinas.js');
const gyms = await import('../gyms.js');
const { lastDataFor } = await import('../session.js');

// Enzo, 2026-10-06: el mismo Close grip row en la Low row machine y en la
// polea. Cada máquina es una foto con el nombre que él le pone; elegirla
// cambia el nombre que se ve ("Close grip row en Polea") y el historial.
beforeEach(() => {
  fotos.clear();
  S.cfg = { ...(S.cfg || {}), activeGym: 'g1', unit: 'kg' };
  S.gyms = [{ id: 'g1', name: 'Mi gym', equip: {} }, { id: 'g2', name: 'Otro', equip: {} }];
  S.routine = [{ id: 's1', type: 'workout', name: 'Espalda', exercises: [{ id: 'cg', name: 'Close grip row', sets: 3, reps: 10 }] }];
  S.sessions = [];
  S.draft = null;
});

describe('la clave del historial', () => {
  it('sin máquina elegida es la de siempre', () => {
    expect(exKey({ name: 'Close grip row' })).toBe('close grip row');
  });
  it('con máquina, se separa por máquina', () => {
    expect(exKey({ name: 'Close grip row', variante: 'm1' })).not.toBe(exKey({ name: 'Close grip row', variante: 'm2' }));
    expect(exKey({ name: 'Close grip row', variante: 'm1' })).not.toBe(exKey({ name: 'Close grip row' }));
  });
});

describe('máquinas por ejercicio y gimnasio', () => {
  it('crear una la deja elegida y el nombre del ejercicio la dice', async () => {
    const m = await gyms.crearMaquina('g1', 'Close grip row', 'Polea', new Blob(['x']));
    const ex = S.routine[0].exercises[0];
    expect(ex.variante).toBe(m.id);
    expect(nombreConMaquina(ex)).toBe('Close grip row en Polea');
    expect(fotos.has(`g1::close grip row::${m.id}`)).toBe(true);
  });

  it('cada máquina trae su propio historial', async () => {
    const polea = await gyms.crearMaquina('g1', 'Close grip row', 'Polea');
    const low = await gyms.crearMaquina('g1', 'Close grip row', 'Low row');
    S.sessions = [
      { id: 'a', date: '2026-10-05', entries: [{ name: 'Close grip row', variante: polea.id, sets: [{ w: 40, r: 10 }] }] },
      { id: 'b', date: '2026-10-04', entries: [{ name: 'Close grip row', variante: low.id, sets: [{ w: 70, r: 10 }] }] },
    ];
    const ex = S.routine[0].exercises[0];
    await gyms.elegirMaquina('g1', 'Close grip row', low.id);
    expect(lastDataFor(ex)[0].w).toBe(70);
    await gyms.elegirMaquina('g1', 'Close grip row', polea.id);
    expect(lastDataFor(ex)[0].w).toBe(40);
  });

  it('la foto que ya tenías pasa a ser "Máquina 1" y conserva tus pesos', async () => {
    fotos.set('g1::close grip row', { id: 'g1::close grip row', blob: new Blob(['vieja']) });
    S.sessions = [{ id: 'a', date: '2026-10-01', entries: [{ name: 'Close grip row', sets: [{ w: 55, r: 10 }] }] }];
    await gyms.asegurarLegado('g1', 'Close grip row');
    const [m1] = maquinasDe('g1', 'Close grip row');
    expect(m1.nombre).toBe('Máquina 1');
    await gyms.elegirMaquina('g1', 'Close grip row', m1.id);
    const ex = S.routine[0].exercises[0];
    expect(nombreConMaquina(ex)).toBe('Close grip row en Máquina 1');
    expect(lastDataFor(ex)[0].w).toBe(55);   // el historial de siempre
    expect(await gyms.getPhoto('g1', 'Close grip row', m1.id)).toBeTruthy();
  });

  it('sin foto vieja no se inventa una Máquina 1', async () => {
    await gyms.asegurarLegado('g1', 'Close grip row');
    expect(maquinasDe('g1', 'Close grip row')).toEqual([]);
  });

  it('renombrar no parte el historial', async () => {
    const m = await gyms.crearMaquina('g1', 'Close grip row', 'Polea');
    const antes = exKey(S.routine[0].exercises[0]);
    await gyms.renombrarMaquina('g1', 'Close grip row', m.id, 'Polea alta');
    const ex = S.routine[0].exercises[0];
    expect(exKey(ex)).toBe(antes);
    expect(nombreConMaquina(ex)).toBe('Close grip row en Polea alta');
  });

  it('borrar la elegida vuelve al ejercicio sin máquina', async () => {
    const m = await gyms.crearMaquina('g1', 'Close grip row', 'Polea', new Blob(['x']));
    await gyms.borrarMaquina('g1', 'Close grip row', m.id);
    const ex = S.routine[0].exercises[0];
    expect(ex.variante).toBeUndefined();
    expect(nombreConMaquina(ex)).toBe('Close grip row');
    expect(fotos.size).toBe(0);
  });

  it('son de cada gimnasio: en otro gym no aparece', async () => {
    await gyms.crearMaquina('g1', 'Close grip row', 'Polea');
    expect(maquinasDe('g2', 'Close grip row')).toEqual([]);
    const ex = S.routine[0].exercises[0];
    S.cfg.activeGym = 'g2';
    aplicarMaquina(ex);
    expect(ex.variante).toBeUndefined();
  });
});
