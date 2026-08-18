import { S, bump, loadAll, resolveAutoRest, saveCfg } from './state.js';
import { idb } from './db.js';

describe('state.js — portado de web/src/lib/state.js', () => {
  beforeEach(async () => {
    for (const s of ['routine', 'sessions', 'meals', 'foods', 'body', 'settings']) await idb.clear(s);
    S.routine = []; S.sessions = []; S.ready = false;
  });

  it('loadAll() deja S.ready en true y ordena S.routine por order', async () => {
    await idb.put('routine', { id: 'b', order: 1, type: 'rest' });
    await idb.put('routine', { id: 'a', order: 0, type: 'workout', exercises: [] });
    await loadAll();
    expect(S.ready).toBe(true);
    expect(S.routine.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('loadAll() hidrata S.cfg desde settings, mezclando con los defaults', async () => {
    await idb.put('settings', { key: 'cfg', value: { rest: 120 } });
    await loadAll();
    expect(S.cfg.rest).toBe(120);
    expect(S.cfg.unit).toBe('kg'); // default no pisado
  });

  it('resolveAutoRest() no rompe con S.routine vacío', async () => {
    await loadAll();
    await expect(resolveAutoRest()).resolves.not.toThrow();
  });

  it('saveCfg() persiste S.cfg en el store settings', async () => {
    await loadAll();
    S.cfg.rest = 180;
    await saveCfg();
    const rows = await idb.all('settings');
    const cfgRow = rows.find(r => r.key === 'cfg');
    expect(cfgRow.value.rest).toBe(180);
  });

  it('bump() no tira si no hay listeners suscriptos', () => {
    expect(() => bump()).not.toThrow();
  });
});
