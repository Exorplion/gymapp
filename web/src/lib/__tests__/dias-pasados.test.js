// Registrar las SERIES de un día pasado (2026-09-29). Enzo perdió el domingo
// 27 y el lunes 28 y no podía volver a cargarlos: anotar un día pasado
// guardaba el turno sin pesos. Ahora, después de elegir el turno, se cargan
// las series prellenadas con lo que hizo la última vez ANTES de ese día (o con
// su meta, si nunca lo hizo), y lo cargado cuenta como una sesión real.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { idb } from '../db.js';
import { registrarDiaEntrenado, seriesPrellenadas, seriesDeEjercicio, cargarSeriesRetro, sessionPRs, lastDataFor } from '../session.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const DOM = '2026-09-27';
const press = { id: 'e1', name: 'Press banca', sets: 3, reps: 8, equip: 'barra' };
const remo = { id: 'e2', name: 'Remo sentado', sets: 2, reps: 10, equip: 'polea' };

beforeEach(() => {
  vi.clearAllMocks();
  S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Anterior A', exercises: [press, remo] }];
  S.sessions = [];
  S.draft = null;
  S.cfg.seqIndex = 0;
  S.cfg.seqIndexDate = null;
});

describe('seriesPrellenadas', () => {
  it('usa las series de la última vez ANTES de ese día, no las de después', () => {
    S.sessions = [
      { id: 'despues', date: '2026-09-29', start: Date.parse('2026-09-29T12:00:00'), entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 90, r: 5 }] }] },
      { id: 'antes', date: '2026-09-24', start: Date.parse('2026-09-24T12:00:00'), entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 80, r: 8 }, { w: 80, r: 7 }] }] },
    ];
    const [e] = seriesPrellenadas('s1', DOM);
    expect(e.name).toBe('Press banca');
    expect(e.sets.map(s => [s.w, s.r])).toEqual([[80, 8], [80, 7]]);
  });

  it('sin historial arma las series del turno con la meta (reps del plan)', () => {
    const [, r] = seriesPrellenadas('s1', DOM);
    expect(r.name).toBe('Remo sentado');
    expect(r.sets).toHaveLength(2);
    expect(r.sets.every(s => s.r === 10 && s.w > 0)).toBe(true);
  });

  it('trae todos los ejercicios del turno, con lo necesario para compararlos después', () => {
    const es = seriesPrellenadas('s1', DOM);
    expect(es.map(e => e.exId)).toEqual(['e1', 'e2']);
    expect(es[0]).toMatchObject({ name: 'Press banca', equip: 'barra' });
  });

  it('un turno que no existe no inventa nada', () => {
    expect(seriesPrellenadas('no-existe', DOM)).toEqual([]);
  });
});

/* "＋ ejercicio" en "Corregir lo que anoté" arrancaba en 20 kg fijos. Ahora
   usa lo mismo que la carga de un día pasado: la última vez de ESE
   ejercicio antes de la fecha de la sesión, o la meta si nunca se hizo. */
describe('seriesDeEjercicio (＋ ejercicio al corregir)', () => {
  it('trae las series de la última vez antes de la fecha de la sesión', () => {
    S.sessions = [
      { id: 'mismo-dia', date: DOM, start: Date.parse(DOM + 'T12:00:00'), entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 99, r: 1 }] }] },
      { id: 'antes', date: '2026-09-24', start: Date.parse('2026-09-24T12:00:00'), entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 80, r: 8 }, { w: 80, r: 7 }] }] },
    ];
    expect(seriesDeEjercicio(press, DOM).map(s => [s.w, s.r])).toEqual([[80, 8], [80, 7]]);
  });

  it('sin historial usa la meta del plan (acá, el peso de partida), no 20 kg fijos', () => {
    const sets = seriesDeEjercicio({ ...remo, pesoInicialKg: 35 }, DOM);
    expect(sets).toHaveLength(2);
    expect(sets.every(s => s.w === 35 && s.r === 10)).toBe(true);
  });

  it('seriesPrellenadas sigue dando lo mismo (usa la misma función)', () => {
    S.sessions = [{ id: 'antes', date: '2026-09-24', start: 1, entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 80, r: 8 }] }] }];
    const [e] = seriesPrellenadas('s1', DOM);
    expect(e.sets.map(s => [s.w, s.r])).toEqual(seriesDeEjercicio(press, DOM).map(s => [s.w, s.r]));
  });
});

describe('cargarSeriesRetro', () => {
  it('llena la sesión anotada con las series prellenadas y la guarda con SU fecha', async () => {
    const sess = await registrarDiaEntrenado(DOM, 's1');
    const lista = await cargarSeriesRetro(sess.id);
    const guardada = S.sessions.find(s => s.id === sess.id);
    expect(lista.entries).toHaveLength(2);
    expect(guardada.entries).toHaveLength(2);
    expect(guardada.date).toBe(DOM);
    expect(idb.put).toHaveBeenLastCalledWith('sessions', expect.objectContaining({ id: sess.id, date: DOM }));
  });

  it('no pisa una sesión que ya tiene series', async () => {
    S.sessions = [{ id: 'x', date: DOM, slotId: 's1', start: 1, entries: [{ name: 'Press banca', sets: [{ w: 1, r: 1 }] }] }];
    expect(await cargarSeriesRetro('x')).toBe(null);
    expect(S.sessions[0].entries[0].sets[0].w).toBe(1);
  });

  it('lo cargado cuenta como sesión real: récords y última vez', async () => {
    S.sessions = [{ id: 'vieja', date: '2026-09-20', start: Date.parse('2026-09-20T12:00:00'), entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 70, r: 8 }] }] }];
    const sess = await registrarDiaEntrenado(DOM, 's1');
    await cargarSeriesRetro(sess.id);
    const s = S.sessions.find(x => x.id === sess.id);
    s.entries[0].sets[0].w = 85;   // lo corrige a lo que de verdad levantó
    expect(sessionPRs(s).map(p => p.name)).toContain('Press banca');
    expect(lastDataFor(press)[0].w).toBe(85);
  });
});
