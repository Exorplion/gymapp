// Ayudas compartidas por los tests de turnos que corren contra una IndexedDB
// de verdad (fake-indexeddb) y el loadAll() real. No es un test.
import 'fake-indexeddb/auto';
import { idbOpen, DB, idb } from '../db.js';
import { S, loadAll } from '../state.js';
import { dstr } from '../format.js';
import { firma } from '../turnos.js';

export const CFG0 = structuredClone(S.cfg);
export const HOY = dstr();
export const ex = (id, name, sets = 3, extra = {}) => ({ id, name, sets, reps: 10, ...extra });
export const w = (id, order, name, exercises) => ({ id, order, type: 'workout', name, exercises });
export const r = (id, order) => ({ id, order, type: 'rest' });

/** A · P · R · A · P · R · R, cada copia con ids propios (como applyDays). */
export const semana = ({ posteriorViernes } = {}) => [
  w('s0', 0, 'Anterior', [ex('a1', 'Press plano', 4), ex('a2', 'Hack squat', 4)]),
  w('s1', 1, 'Posterior', [ex('p1', 'Curl femoral', 3), ex('p2', 'Remo', 4)]),
  r('s2', 2),
  w('s3', 3, 'Anterior', [ex('a3', 'Press plano', 4), ex('a4', 'Hack squat', 4)]),
  w('s4', 4, 'Posterior', posteriorViernes || [ex('p3', 'Curl femoral', 3), ex('p4', 'Remo', 4)]),
  r('s5', 5),
  r('s6', 6),
];

/** Lo que hay en disco, crudo: lo que leería la versión vieja de la app. */
export async function disco() {
  const settings = Object.fromEntries((await idb.all('settings')).map(kv => [kv.key, kv.value]));
  return { routine: (await idb.all('routine')).sort((a, b) => a.order - b.order), settings };
}

/** "Recargar la app": memoria en blanco y loadAll() sobre la misma base. */
export async function recargar() {
  Object.assign(S, { routine: [], turnos: null, turnosSinVincular: [], lib: [], gyms: [], draft: null, sessions: [], cfg: structuredClone(CFG0) });
  await loadAll();
}

/** Base nueva con estas filas (y lo demás que haga falta) y un arranque. */
export async function arrancar(filas = semana(), { draft, sessions = [], lib, cfg = {} } = {}) {
  DB.db?.close(); DB.db = null; DB.ver = 3; DB.name = `fierro-turnos-${Math.random().toString(36).slice(2)}`;
  await idbOpen();
  await idb.clear('routine');
  for (const f of filas) await idb.put('routine', f);
  for (const s of sessions) await idb.put('sessions', s);
  await idb.put('settings', { key: 'cfg', value: { ...CFG0, seqIndex: 0, seqIndexDate: HOY, ...cfg } });
  if (lib) await idb.put('settings', { key: 'lib', value: lib });
  if (draft) await idb.put('settings', { key: 'draft', value: draft });
  await recargar();
}

/** Cada fila cruda de entrenamiento tiene name/exercises completos e iguales a su turno. */
export function filasCompatibles({ routine, settings }) {
  return routine.filter(f => f.type === 'workout').every(f => {
    const t = (settings.turnos || []).find(x => x.id === f.turnoId);
    return t && f.name === t.name && JSON.stringify(f.exercises) === JSON.stringify(t.exercises) && f.turnoFirma === firma(t);
  });
}
