// Respaldo v3: exporta los turnos, y restaurar un backup viejo (sin turnos)
// borra la clave para que al recargar la reconciliación unifique sus filas.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { datosDelRespaldo, importJSON } from '../backup.js';
import { esVinculado } from '../turnos.js';
import { arrancar, recargar, disco, semana, ex, filasCompatibles } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const archivo = d => ({ text: async () => JSON.stringify(d) });

beforeEach(() => { globalThis.location = { reload: vi.fn() }; });
afterEach(() => { delete globalThis.location; vi.restoreAllMocks(); });

describe('exportar (v3)', () => {
  beforeEach(() => arrancar());

  it('lleva version 3, los turnos y filas planas con firma', () => {
    const d = JSON.parse(JSON.stringify(datosDelRespaldo([])));
    expect(d.version).toBe(3);
    expect(d.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(d.routine).toHaveLength(7);
    expect(filasCompatibles({ routine: d.routine, settings: { turnos: d.turnos } })).toBe(true);
  });
});

describe('importar', () => {
  it('un v3 escribe la rutina y los turnos juntos, y al recargar no hay nada que unificar', async () => {
    await arrancar();
    const d = JSON.parse(JSON.stringify({ app: 'fierro', ...datosDelRespaldo([]) }));
    await arrancar([]);   // otro teléfono, vacío
    const tx = vi.spyOn(idb, 'tx');
    await importJSON(archivo(d));
    expect(tx).toHaveBeenCalledTimes(1);
    expect((await disco()).settings.turnos.map(t => t.id)).toEqual(d.turnos.map(t => t.id));
    tx.mockClear();
    await recargar();
    expect(tx).not.toHaveBeenCalled();   // todo en orden: la reconciliación no escribe
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
    expect(esVinculado(S.routine[4])).toBe(true);
  });

  it('un backup viejo (v2, sin turnos) borra la clave, y al recargar se unifica', async () => {
    await arrancar();   // ya migrado, con turnos
    const viejo = {
      app: 'fierro', version: 2,
      routine: semana({ posteriorViernes: [ex('p3', 'Curl femoral', 2), ex('p4', 'Remo', 4)] }),
      sessions: [], meals: [], foods: [], body: [],
    };
    await importJSON(archivo(viejo));
    let d = await disco();
    expect(d.settings.turnos).toBeUndefined();
    expect(d.routine[4].turnoId).toBeUndefined();
    await recargar();
    d = await disco();
    expect(d.settings.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(d.routine[4].exercises[0].sets).toBe(3);    // gana la primera
    expect(S.lib[0].days[4].exercises[0].sets).toBe(2); // la otra, en el respaldo
    expect(S.cfg.avisoTurnos.grupos[0].nombre).toBe('Posterior');
    expect(filasCompatibles(d)).toBe(true);
  });

  it('un backup sin rutina no toca la rutina ni los turnos', async () => {
    await arrancar();
    const antes = await disco();
    await importJSON(archivo({ app: 'fierro', version: 2, sessions: [] }));
    const d = await disco();
    expect(d.routine).toEqual(antes.routine);
    expect(d.settings.turnos).toEqual(antes.settings.turnos);
  });
});
