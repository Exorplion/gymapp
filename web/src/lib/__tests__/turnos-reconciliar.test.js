// La reconciliación al arrancar, contra una IndexedDB de verdad
// (fake-indexeddb) y el loadAll() real: lo que la app hace con los datos de
// Enzo la primera vez que abre la versión con turnos universales.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from '../db.js';
import { S, loadAll } from '../state.js';
import { dstr } from '../format.js';
import { esVinculado, firma, nombreRespaldo } from '../turnos.js';

const CFG0 = structuredClone(S.cfg);
const HOY = dstr();
const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });
const w = (id, order, name, exercises) => ({ id, order, type: 'workout', name, exercises });
const r = (id, order) => ({ id, order, type: 'rest' });

function semana({ posteriorViernes } = {}) {
  return [
    w('s0', 0, 'Anterior', [ex('a1', 'Press plano', 4), ex('a2', 'Hack squat', 4)]),
    w('s1', 1, 'Posterior', [ex('p1', 'Curl femoral', 3), ex('p2', 'Remo', 4)]),
    r('s2', 2),
    w('s3', 3, 'Anterior', [ex('a3', 'Press plano', 4), ex('a4', 'Hack squat', 4)]),
    w('s4', 4, 'Posterior', posteriorViernes || [ex('p3', 'Curl femoral', 3), ex('p4', 'Remo', 4)]),
    r('s5', 5),
    r('s6', 6),
  ];
}
const DISTINTA = [ex('p3', 'Curl femoral', 2), ex('p4', 'Remo', 4), ex('p5', 'Hip thrust', 3)];

async function baseNueva() {
  DB.db?.close(); DB.db = null; DB.ver = 3; DB.name = `fierro-turnos-${Math.random().toString(36).slice(2)}`;
  await idbOpen();
  await idb.clear('routine');   // una base nueva trae 7 descansos de relleno
}

/** Lo que hay en disco, crudo — como lo leería la versión vieja de la app. */
async function disco() {
  const settings = Object.fromEntries((await idb.all('settings')).map(kv => [kv.key, kv.value]));
  return { routine: (await idb.all('routine')).sort((a, b) => a.order - b.order), settings };
}

async function sembrar(filas, { draft = null, lib = [], cfg = {} } = {}) {
  for (const f of filas) await idb.put('routine', f);
  await idb.put('settings', { key: 'cfg', value: { ...CFG0, seqIndex: 3, seqIndexDate: HOY, ...cfg } });
  await idb.put('settings', { key: 'lib', value: lib });
  if (draft) await idb.put('settings', { key: 'draft', value: draft });
}

/** "Recargar la app": memoria en blanco y loadAll() otra vez sobre la misma base. */
async function recargar() {
  Object.assign(S, { routine: [], turnos: null, turnosSinVincular: [], lib: [], gyms: [], draft: null, sessions: [], cfg: structuredClone(CFG0) });
  await loadAll();
}

describe('reconciliarTurnos en loadAll', () => {
  beforeEach(baseNueva);
  afterEach(() => vi.restoreAllMocks());

  it('copias distintas: un turno por nombre, gana la primera, respaldo con TODAS las copias y aviso', async () => {
    const original = semana({ posteriorViernes: DISTINTA });
    await sembrar(original, { lib: [{ id: 'mia', name: 'Mi rutina', days: [], savedAt: '2026-01-01' }] });
    await recargar();

    const { routine, settings } = await disco();
    // filas: ids, orden y tipo intactos; cada entrenamiento con turnoId, firma y copia completa
    expect(routine.map(f => [f.id, f.order, f.type])).toEqual(original.map(f => [f.id, f.order, f.type]));
    const post = settings.turnos.find(t => t.name === 'Posterior');
    expect(post.exercises.map(e => [e.name, e.sets])).toEqual([['Curl femoral', 3], ['Remo', 4]]);
    for (const i of [1, 4]) {
      expect(routine[i].turnoId).toBe(post.id);
      expect(routine[i].exercises).toEqual(post.exercises);
      expect(routine[i].turnoFirma).toBe(firma(post));
    }
    expect(settings.turnos).toHaveLength(2);
    // las filas crudas de antes, exactas
    expect(settings.rutinaAntesDeTurnos.filas).toEqual(original);
    // el respaldo, primero en Mis rutinas, con la secuencia entera como estaba
    expect(settings.lib.map(x => x.name)).toEqual([nombreRespaldo(HOY), 'Mi rutina']);
    const dias = settings.lib[0].days;
    expect(dias).toHaveLength(7);
    expect(dias[1].exercises.map(e => e.sets)).toEqual([3, 4]);
    expect(dias[4].exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo', 'Hip thrust']);
    expect(dias[4].exercises[0].sets).toBe(2);
    // aviso y marca
    expect(settings.cfg.avisoTurnos.grupos).toEqual([{ nombre: 'Posterior', versiones: 2, gano: 'primera' }]);
    expect(settings.cfg.turnosMigrados).toBe(HOY);
    // el puntero no se movió
    expect(S.cfg.seqIndex).toBe(3);
    // en memoria: vinculados
    expect(esVinculado(S.routine[1]) && esVinculado(S.routine[4])).toBe(true);
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
    expect(S.lib[0].name).toBe(nombreRespaldo(HOY));
  });

  it('copias idénticas: un turno, sin respaldo ni aviso (pero con las filas crudas guardadas)', async () => {
    await sembrar(semana());
    await recargar();
    const { settings } = await disco();
    expect(settings.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(settings.lib).toEqual([]);
    expect(settings.cfg.avisoTurnos).toBeUndefined();
    expect(settings.rutinaAntesDeTurnos.filas).toHaveLength(7);
  });

  it('con un borrador abierto no migra: no escribe nada y abre en el modo viejo', async () => {
    const original = semana({ posteriorViernes: DISTINTA });
    const draft = { id: 'd', slotId: 's4', dayName: 'Posterior', entries: { p5: { sets: [{ w: 50, r: 10 }] } }, order: ['p3', 'p4', 'p5'] };
    await sembrar(original, { draft });
    const antes = await disco();
    await recargar();
    const despues = await disco();
    expect(despues.routine).toEqual(antes.routine);
    expect(despues.settings.turnos).toBeUndefined();
    expect(despues.settings.rutinaAntesDeTurnos).toBeUndefined();
    expect(S.turnos).toBeNull();
    expect(esVinculado(S.routine[4])).toBe(false);
    // la sesión sigue encontrando sus ejercicios
    expect(S.routine[4].exercises.map(e => e.id)).toEqual(['p3', 'p4', 'p5']);

    // cerrada la sesión, el próximo arranque migra
    await idb.del('settings', 'draft');
    await recargar();
    expect((await disco()).settings.turnos).toHaveLength(2);
  });

  it('correr dos veces: la segunda no escribe nada', async () => {
    await sembrar(semana({ posteriorViernes: DISTINTA }));
    await recargar();
    const primera = await disco();
    const tx = vi.spyOn(idb, 'tx');
    await recargar();
    expect(tx).not.toHaveBeenCalled();
    const segunda = await disco();
    expect(segunda.routine).toEqual(primera.routine);
    expect(segunda.settings.turnos).toEqual(primera.settings.turnos);
    expect(segunda.settings.lib).toHaveLength(1);   // un solo respaldo, no uno por arranque
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
  });

  it('si la transacción aborta (sin espacio), no cambia nada y la app abre con lo de antes', async () => {
    const original = semana({ posteriorViernes: DISTINTA });
    await sembrar(original);
    const antes = await disco();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (v, k) {
      if (v?.key === 'turnos') throw new DOMException('sin lugar', 'QuotaExceededError');
      return put.call(this, v, k);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await recargar();
    vi.mocked(IDBObjectStore.prototype.put).mockRestore();
    const despues = await disco();
    expect(despues.routine).toEqual(antes.routine);
    expect(despues.settings.turnos).toBeUndefined();
    expect(despues.settings.lib).toEqual(antes.settings.lib);
    expect(despues.settings.cfg.avisoTurnos).toBeUndefined();
    expect(S.ready).toBe(true);
    expect(S.turnos).toBeNull();
    expect(S.routine.map(s => s.exercises?.length)).toEqual([2, 2, undefined, 2, 3, undefined, undefined]);
    expect(S.lib).toEqual([]);
    expect(S.cfg.avisoTurnos).toBeUndefined();
  });

  it('una fila editada por la versión vieja después de migrar gana, y lo anterior va al respaldo', async () => {
    await sembrar(semana());
    await recargar();
    // la versión vieja edita el Posterior del viernes: cambia la copia, deja la firma vieja
    const fila = (await disco()).routine[4];
    fila.exercises[0].sets = 5;
    await idb.put('routine', fila);
    await recargar();
    const { routine, settings } = await disco();
    const post = settings.turnos.find(t => t.name === 'Posterior');
    expect(post.id).toBe(fila.turnoId);
    expect(post.exercises[0].sets).toBe(5);
    expect(routine[1].exercises[0].sets).toBe(5);
    expect(settings.cfg.avisoTurnos.grupos).toEqual([{ nombre: 'Posterior', versiones: 2, gano: 'editada' }]);
    expect(settings.lib[0].days[1].exercises[0].sets).toBe(3);   // lo que había antes, respaldado
    // las filas crudas guardadas son las de la PRIMERA migración, no se pisan
    expect(settings.rutinaAntesDeTurnos.filas[4].turnoId).toBeUndefined();
  });
});
