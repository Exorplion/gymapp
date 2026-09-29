// Peso corporal con fecha elegible (2026-09-29): "no he podido registrar mis
// pesos de los otros días". BodyForm guardaba siempre con la fecha de hoy.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { guardarRegistroCorporal } from '../cuerpo.js';
import { dstr } from '../format.js';

vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn(), get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  S.body = [];
  S.cfg.profile = { ...(S.cfg.profile || {}), weightKg: 80 };
});

describe('guardarRegistroCorporal', () => {
  it('guarda con la fecha elegida', async () => {
    const rec = await guardarRegistroCorporal({ weight: '79.4' }, '2026-09-27');
    expect(rec.date).toBe('2026-09-27');
    expect(rec.weight).toBe(79.4);
    expect(idb.put).toHaveBeenCalledWith('body', expect.objectContaining({ date: '2026-09-27', weight: 79.4 }));
  });

  it('sin fecha, es hoy', async () => {
    expect((await guardarRegistroCorporal({ weight: '80' })).date).toBe(dstr());
  });

  it('no registra el futuro', async () => {
    expect(await guardarRegistroCorporal({ weight: '80' }, '2099-01-01')).toBe(null);
    expect(idb.put).not.toHaveBeenCalled();
  });

  it('sin ningún dato no guarda', async () => {
    expect(await guardarRegistroCorporal({ weight: '' }, '2026-09-27')).toBe(null);
  });

  it('queda ordenado por fecha en S.body', async () => {
    S.body = [{ id: 'a', date: '2026-09-25', weight: 80 }, { id: 'b', date: '2026-09-29', weight: 79 }];
    await guardarRegistroCorporal({ weight: '79.5' }, '2026-09-27');
    expect(S.body.map(b => b.date)).toEqual(['2026-09-25', '2026-09-27', '2026-09-29']);
  });

  it('un peso VIEJO no pisa el peso actual del perfil', async () => {
    S.body = [{ id: 'b', date: '2026-09-29', weight: 79 }];
    S.cfg.profile.weightKg = 79;
    await guardarRegistroCorporal({ weight: '82' }, '2026-09-27');
    expect(S.cfg.profile.weightKg).toBe(79);
  });

  it('el peso más reciente sí actualiza el perfil', async () => {
    S.body = [{ id: 'a', date: '2026-09-25', weight: 80 }];
    await guardarRegistroCorporal({ weight: '78' }, '2026-09-27');
    expect(S.cfg.profile.weightKg).toBe(78);
  });
});

describe('BodyForm', () => {
  it('tiene un selector de fecha que arranca en hoy y no deja elegir el futuro', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: BodyForm } = await import('../../components/sheets/BodyForm.jsx');
    const h = renderToStaticMarkup(createElement(BodyForm));
    const input = h.match(/<input[^>]*type="date"[^>]*>/)?.[0] || '';
    expect(input).toContain(`max="${dstr()}"`);
    expect(input).toContain(`value="${dstr()}"`);
  });
});
