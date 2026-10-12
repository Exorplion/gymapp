import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import {
  PISTAS, TEXTOS, pistaQueToca, guiaInicial, iniciarGuia, marcarGuia, reiniciarGuia, vista,
} from '../guia.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn(), get: vi.fn() } }));

/* Lo que ve la pantalla de la sesión, armado a mano: sin hoja, sin descanso
   tapando, con la tarjeta abierta (botón, ruedas y ⋯) y todavía sin series. */
const base = {
  hoja: false, descanso: null, hayRir: false,
  hayBoton: true, hayRueda: true, hayTabla: false, hayDots: true, ejerciciosPrevios: 0,
};
const todas = Object.fromEntries(PISTAS.map(p => [p, true]));

beforeEach(() => {
  S.cfg = { unit: 'kg' };
  S.sessions = [];
  vi.mocked(idb.put).mockClear();
});

describe('los cinco avisos', () => {
  it('son cinco, en el orden de prioridad, cada uno con su texto', () => {
    expect(PISTAS).toEqual(['btn', 'rueda', 'rir', 'tabla', 'dots']);
    for (const p of PISTAS) expect(TEXTOS[p]).toMatch(/\S/);
    expect(TEXTOS.btn).toBe('Hacé la serie y tocá acá. El descanso arranca solo.');
  });
});

describe('qué aviso toca', () => {
  it('el primero es el del botón de la serie', () => {
    expect(pistaQueToca(base, {})).toBe('btn');
  });

  it('sin el botón a la vista (aproximación, nada abierto) no hay aviso del botón', () => {
    expect(pistaQueToca({ ...base, hayBoton: false }, {})).toBe(null);
  });

  it('la rueda recién cuando el del botón ya se usó, nunca a la vez', () => {
    expect(pistaQueToca(base, {})).toBe('btn');
    expect(pistaQueToca(base, { btn: true })).toBe('rueda');
  });

  it('la tabla, cuando tiene una fila y ya no quedan avisos antes', () => {
    const conTabla = { ...base, hayTabla: true };
    expect(pistaQueToca(conTabla, { btn: true })).toBe('rueda');
    expect(pistaQueToca(conTabla, { btn: true, rueda: true })).toBe('tabla');
    expect(pistaQueToca({ ...conTabla, hayTabla: false }, { btn: true, rueda: true })).toBe(null);
  });

  it('el ⋯ espera a que los otros cuatro estén vistos', () => {
    const visto = { btn: true, rueda: true, tabla: true };
    expect(pistaQueToca(base, visto)).toBe(null);
    expect(pistaQueToca(base, { ...visto, rir: true })).toBe('dots');
  });

  it('o aparece en el tercer ejercicio, aunque falte alguno', () => {
    const visto = { btn: true, rueda: true, tabla: true };
    expect(pistaQueToca({ ...base, ejerciciosPrevios: 1 }, visto)).toBe(null);
    expect(pistaQueToca({ ...base, ejerciciosPrevios: 2 }, visto)).toBe('dots');
  });

  it('uno por vez y en orden: el de más prioridad tapa a los demás', () => {
    const todo = { ...base, hayTabla: true, ejerciciosPrevios: 3 };
    expect(pistaQueToca(todo, { btn: true })).toBe('rueda');
  });

  it('con una hoja abierta, ninguno', () => {
    expect(pistaQueToca({ ...base, hoja: true }, {})).toBe(null);
  });

  it('con el descanso a pantalla completa, sólo el del RIR', () => {
    const fs = { ...base, descanso: 'fullscreen', hayRir: true };
    expect(pistaQueToca(fs, {})).toBe('rir');
    expect(pistaQueToca({ ...fs, hayRir: false }, {})).toBe(null);
    expect(pistaQueToca(fs, { rir: true })).toBe(null);
  });

  it('sonando, ni siquiera el del RIR', () => {
    expect(pistaQueToca({ ...base, descanso: 'ringing', hayRir: true }, {})).toBe(null);
  });

  it('el del RIR no sale fuera del descanso, y la barra minimizada no tapa a los demás', () => {
    expect(pistaQueToca({ ...base, hayRir: true }, { btn: true, rueda: true })).toBe(null);
    expect(pistaQueToca({ ...base, descanso: 'minimized' }, { btn: true })).toBe('rueda');
  });

  it('todos vistos: nada', () => {
    expect(pistaQueToca({ ...base, hayTabla: true, ejerciciosPrevios: 5 }, todas)).toBe(null);
  });
});

describe('quién ya usa la app no ve la guía', () => {
  it('sin decisión previa y con sesiones guardadas: todo visto', () => {
    expect(guiaInicial(undefined, 3)).toEqual({ visto: todas });
  });

  it('sin decisión previa y sin sesiones: nada visto', () => {
    expect(guiaInicial(undefined, 0)).toEqual({ visto: {} });
  });

  it('ya decidido: no se toca (null = nada que cambiar)', () => {
    expect(guiaInicial({ visto: { btn: true } }, 10)).toBe(null);
  });

  it('iniciarGuia lo decide una sola vez y lo guarda', async () => {
    S.sessions = [{ id: 's1' }];
    await iniciarGuia();
    expect(S.cfg.guia).toEqual({ visto: todas });
    expect(idb.put).toHaveBeenCalledTimes(1);
    // Una segunda carga (o sesiones nuevas) no lo vuelve a decidir.
    S.cfg.guia = { visto: {} };
    await iniciarGuia();
    expect(S.cfg.guia).toEqual({ visto: {} });
    expect(idb.put).toHaveBeenCalledTimes(1);
  });
});

describe('marcar y reiniciar', () => {
  it('marcar un aviso lo da por visto y lo guarda', async () => {
    S.cfg.guia = { visto: {} };
    await marcarGuia('btn');
    expect(vista('btn')).toBe(true);
    expect(vista('rueda')).toBe(false);
    expect(idb.put).toHaveBeenCalledTimes(1);
  });

  it('marcar uno ya visto no escribe nada (se llama en cada serie)', async () => {
    S.cfg.guia = { visto: { btn: true } };
    await marcarGuia('btn');
    expect(idb.put).not.toHaveBeenCalled();
  });

  it('sin guía decidida todavía, marcar igual funciona', async () => {
    await marcarGuia('rir');
    expect(S.cfg.guia).toEqual({ visto: { rir: true } });
  });

  it('"Ver la guía otra vez" vuelve a mostrar todos', async () => {
    S.cfg.guia = { visto: todas };
    await reiniciarGuia();
    expect(S.cfg.guia).toEqual({ visto: {} });
    for (const p of PISTAS) expect(vista(p)).toBe(false);
    expect(idb.put).toHaveBeenCalledTimes(1);
  });
});
