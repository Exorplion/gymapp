// rest.js ya es una implementación real desde Etapa 6a (timer con setInterval
// real de 250ms vía tickRest). Sin mockearlo, cualquier test de este archivo
// que dispare startRest() (indirectamente, vía session.js) dejaría un timer
// real corriendo después de terminar el test — Jest no sale limpio y avisa
// "did not exit"/import-tras-teardown. Nada en este archivo assertea sobre
// startRest/stopRest, así que un stub no-op alcanza.
jest.mock('../rest.js', () => ({
  startRest: jest.fn(),
  stopRest: jest.fn(),
  shiftRest: jest.fn(),
  minimizeRest: jest.fn(),
  expandRest: jest.fn(),
  tickRest: jest.fn(),
  recuperarRest: jest.fn(),
  T: { end: 0, total: 0, int: null, state: 'hidden', leftSec: 0, pct: 0 },
  REST_CIRC: 2 * Math.PI * 88,
}));

import { S } from '../state.js';
import { weekStart, sessionForSlot, sessionPRs, groupSessionsByWeek } from '../session.js';

// dstr() y weekStart() trabajan en hora local, así que las fechas de prueba se
// construyen con el constructor local (año, mes, día), nunca con strings ISO.
const d = (y, m, day) => new Date(y, m - 1, day);

afterEach(() => { jest.useRealTimers(); });

describe('weekStart', () => {
  it('devuelve el lunes de esa semana', () => {
    // 2026-08-04 es martes -> lunes 2026-08-03
    expect(weekStart(d(2026, 8, 4))).toBe('2026-08-03');
  });

  it('un lunes se devuelve a sí mismo', () => {
    expect(weekStart(d(2026, 8, 3))).toBe('2026-08-03');
  });

  it('el domingo cierra la semana que empezó el lunes anterior', () => {
    // 2026-08-09 es domingo -> lunes 2026-08-03, no el 10
    expect(weekStart(d(2026, 8, 9))).toBe('2026-08-03');
  });
});

describe('sessionForSlot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(d(2026, 8, 6));      // jueves
    S.sessions = [];
  });

  it('encuentra la sesión de ese turno en la semana en curso', () => {
    S.sessions = [{ id: 'a', slotId: 'jueves-a', date: '2026-08-06', start: 300 }];
    expect(sessionForSlot('jueves-a')?.id).toBe('a');
  });

  it('ignora la del mismo turno pero de la semana pasada', () => {
    S.sessions = [{ id: 'vieja', slotId: 'jueves-a', date: '2026-07-30', start: 100 }];
    expect(sessionForSlot('jueves-a')).toBe(null);
  });

  it('un turno de esta semana sin sesión devuelve null', () => {
    S.sessions = [{ id: 'a', slotId: 'jueves-a', date: '2026-08-06', start: 300 }];
    expect(sessionForSlot('viernes-b')).toBe(null);
  });
});

describe('sessionPRs', () => {
  beforeEach(() => { S.sessions = []; });

  it('marca récord cuando la mejor serie supera a todo lo anterior', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [nueva, vieja];
    expect(sessionPRs(nueva)).toEqual([{ name: 'Press banca', equip: undefined, machine: undefined, w: 62.5, r: 8 }]);
  });

  it('no marca récord si no supera lo anterior', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 70, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [nueva, vieja];
    expect(sessionPRs(nueva)).toEqual([]);
  });

  it('sólo compara contra sesiones anteriores, no contra las posteriores', () => {
    const media = { id: 'm', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    const futura = { id: 'f', start: 300, entries: [{ name: 'Press banca', sets: [{ w: 80, r: 8 }] }] };
    S.sessions = [futura, media];
    expect(sessionPRs(media)).toHaveLength(1);
  });

  it('funciona igual esté o no la sesión dentro de S.sessions', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Press banca', sets: [{ w: 62.5, r: 8 }] }] };
    S.sessions = [vieja];               // todavía no se guardó
    expect(sessionPRs(nueva)).toHaveLength(1);
  });

  // El peso "por lado" no se traslada al total: un 20kg por lado de récord
  // luce el doble de impresionante de lo que fue si se muestra pelado.
  it('lleva la marca de unilateral, para que la ficha diga "por lado"', () => {
    const vieja = { id: 'v', start: 100, entries: [{ name: 'Curl unilateral', sets: [{ w: 15, r: 10 }] }] };
    const nueva = { id: 'n', start: 200, entries: [{ name: 'Curl unilateral', unilateral: true, sets: [{ w: 17.5, r: 10 }] }] };
    S.sessions = [nueva, vieja];
    expect(sessionPRs(nueva)).toEqual([{ name: 'Curl unilateral', equip: undefined, machine: undefined, unilateral: true, w: 17.5, r: 10 }]);
  });
});

describe('groupSessionsByWeek', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(d(2026, 8, 6));
  });

  it('etiqueta esta semana, la pasada y las más viejas por fecha', () => {
    const g = groupSessionsByWeek([
      { id: 'a', date: '2026-08-06' },
      { id: 'b', date: '2026-08-03' },
      { id: 'c', date: '2026-07-29' },
      { id: 'd', date: '2026-07-15' },
    ]);
    expect(g.map(x => x.label)).toEqual(['Esta semana', 'Semana pasada', 'Semana del 13 jul']);
    expect(g[0].sessions).toHaveLength(2);
  });

  it('una lista vacía no produce grupos', () => {
    expect(groupSessionsByWeek([])).toEqual([]);
  });
});
