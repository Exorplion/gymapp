// Guardar el turno entero: el editor de hoy sigue editando por índice, y el
// cambio tiene que llegar a TODAS las filas del turno, sobrevivir a recargar,
// y quedar legible para la versión vieja de la app (filas crudas completas).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from '../db.js';
import { S, loadAll } from '../state.js';
import { dstr } from '../format.js';
import { esVinculado, firma } from '../turnos.js';
import { saveExercise, deleteExercise, saveSlot, insertRest, persistSlot, turnoDe, turnoDeSesion } from '../rutina-logic.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const CFG0 = structuredClone(S.cfg);
const HOY = dstr();
const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });
const w = (id, order, name, exercises) => ({ id, order, type: 'workout', name, exercises });
const r = (id, order) => ({ id, order, type: 'rest' });
const semana = () => [
  w('s0', 0, 'Anterior', [ex('a1', 'Press plano', 4)]),
  w('s1', 1, 'Posterior', [ex('p1', 'Curl femoral', 3), ex('p2', 'Remo', 4)]),
  r('s2', 2),
  w('s3', 3, 'Anterior', [ex('a3', 'Press plano', 4)]),
  w('s4', 4, 'Posterior', [ex('p3', 'Curl femoral', 3), ex('p4', 'Remo', 4)]),
  r('s5', 5),
  r('s6', 6),
];

async function disco() {
  const settings = Object.fromEntries((await idb.all('settings')).map(kv => [kv.key, kv.value]));
  return { routine: (await idb.all('routine')).sort((a, b) => a.order - b.order), settings };
}
async function recargar() {
  Object.assign(S, { routine: [], turnos: null, turnosSinVincular: [], lib: [], gyms: [], draft: null, sessions: [], cfg: structuredClone(CFG0) });
  await loadAll();
}
async function arrancar(filas = semana(), { draft } = {}) {
  DB.db?.close(); DB.db = null; DB.ver = 3; DB.name = `fierro-persist-${Math.random().toString(36).slice(2)}`;
  await idbOpen();
  await idb.clear('routine');
  for (const f of filas) await idb.put('routine', f);
  await idb.put('settings', { key: 'cfg', value: { ...CFG0, seqIndex: 0, seqIndexDate: HOY } });
  if (draft) await idb.put('settings', { key: 'draft', value: draft });
  await recargar();
}

/** Lo que vería la versión vieja: cada fila cruda tiene name y exercises completos e iguales al turno. */
function compatible({ routine, settings }) {
  for (const f of routine.filter(x => x.type === 'workout')) {
    const t = settings.turnos.find(x => x.id === f.turnoId);
    expect(f.name).toBe(t.name);
    expect(f.exercises).toEqual(t.exercises);
    expect(f.turnoFirma).toBe(firma(t));
  }
}

describe('el editor por índice edita el turno compartido', () => {
  beforeEach(() => arrancar());
  afterEach(() => vi.restoreAllMocks());

  it('saveExercise en el viernes cambia el martes, en memoria y en disco, y sobrevive a recargar', async () => {
    await saveExercise(4, 'p1', { name: 'Curl femoral', sets: 5, reps: 10 });
    expect(S.routine[1].exercises[0].sets).toBe(5);
    let d = await disco();
    expect(d.routine[1].exercises[0].sets).toBe(5);
    expect(d.routine[4].exercises[0].sets).toBe(5);
    compatible(d);

    await recargar();
    expect(S.routine[1].exercises[0].sets).toBe(5);
    expect(S.routine[1].exercises).toBe(S.routine[4].exercises);
    // y sigue vinculado: otra edición después de recargar llega a las dos
    await saveExercise(1, null, { name: 'Hip thrust', sets: 3, reps: 10 });
    d = await disco();
    expect(d.routine[4].exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo', 'Hip thrust']);
    compatible(d);
  });

  it('deleteExercise y saveSlot (renombrar) cambian las dos apariciones', async () => {
    await deleteExercise(1, 'p2');
    await saveSlot(4, { name: 'Posterior B' });
    const d = await disco();
    expect(d.routine[1].exercises.map(e => e.name)).toEqual(['Curl femoral']);
    expect(d.routine[4].name).toBe('Posterior B');
    expect(d.routine[1].name).toBe('Posterior B');
    compatible(d);
  });

  it('un descanso al que le ponés nombre pasa a ser un turno propio', async () => {
    await saveSlot(2, { name: 'Pull' });
    expect(esVinculado(S.routine[2])).toBe(true);
    const d = await disco();
    expect(d.settings.turnos.map(t => t.name)).toContain('Pull');
    expect(d.routine[2].turnoId).toBe(S.routine[2].turnoId);
    compatible(d);
  });

  it('persistAll es una sola transacción: si aborta, la rutina en disco queda como estaba', async () => {
    const antes = await disco();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (v, k) {
      if (v?.key === 'turnos') throw new DOMException('sin lugar', 'QuotaExceededError');
      return put.call(this, v, k);
    });
    await expect(insertRest(0)).rejects.toThrow();
    vi.mocked(IDBObjectStore.prototype.put).mockRestore();
    expect((await disco()).routine).toEqual(antes.routine);
  });

  it('turnoDe y turnoDeSesion', () => {
    const t = turnoDe(4);
    expect(t).toBe(turnoDe('s1'));
    expect(turnoDe(t.id)).toBe(t);
    expect(turnoDe(2)).toBeNull();
    expect(turnoDeSesion({ slotId: 's4' })).toBe(t);              // sesión vieja, por su slot
    expect(turnoDeSesion({ slotId: 'x', turnoId: t.id })).toBe(t);  // sesión nueva
    expect(turnoDeSesion({ slotId: 's1', turnoId: 'borrado' })).toBeNull();
    expect(turnoDeSesion({ weekday: 2 })).toBeNull();
  });
});

describe('con la reconciliación postergada', () => {
  afterEach(() => vi.restoreAllMocks());

  it('primera vez con borrador: modo viejo, cada slot se guarda solo (como antes)', async () => {
    await arrancar(semana(), { draft: { id: 'd', slotId: 's1', entries: {}, order: [] } });
    expect(S.turnos).toBeNull();
    await saveExercise(4, 'p3', { name: 'Curl femoral', sets: 5, reps: 10 });
    const d = await disco();
    expect(d.routine[4].exercises[0].sets).toBe(5);
    expect(d.routine[1].exercises[0].sets).toBe(3);
    expect(d.settings.turnos).toBeUndefined();
  });

  it('una fila editada por la versión vieja no se pisa al guardar el turno desde otra aparición', async () => {
    await arrancar();
    // la versión vieja edita el viernes
    const fila = (await disco()).routine[4];
    fila.exercises[1].sets = 6;
    await idb.put('routine', fila);
    // se abre una sesión y se recarga: la reconciliación se posterga
    await idb.put('settings', { key: 'draft', value: { id: 'd', slotId: 's0', entries: {}, order: [] } });
    await recargar();
    expect(esVinculado(S.routine[1])).toBe(true);
    expect(esVinculado(S.routine[4])).toBe(false);
    // editar Posterior desde el martes
    await saveExercise(1, 'p1', { name: 'Curl femoral', sets: 2, reps: 10 });
    const d = await disco();
    expect(d.routine[1].exercises[0].sets).toBe(2);
    expect(d.routine[4].exercises[1].sets).toBe(6);   // la edición vieja sigue ahí
    // y guardar la fila suelta la deja suelta (firma vieja → se reconcilia después)
    S.routine[4].exercises[0].sets = 1;
    await persistSlot(4);
    expect((await disco()).routine[4].turnoFirma).toBe(fila.turnoFirma);
  });
});
