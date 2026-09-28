// Los datos de la previa del ejercicio (rediseño 2026-09-27, pieza 3): lo
// que ocupa el hueco debajo de la tarjeta antes de empezar. Criterio de la
// app: sin dato, null — nunca un cero, un "NaN" ni un panel vacío.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { dstr } from '../format.js';
import { fuerzaPrevia, sparkPuntos, recordPrevia, haceTexto, recuperacionPrevia } from '../previa.js';
import { e1rmSeries } from '../charts.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));

const PRESS = { id: 'p', name: 'Press plano máquina', cat: 'Pecho', sets: 2, reps: 8 };
const hace = n => dstr(new Date(Date.now() - n * 86400000));
let t = 0;
// S.sessions va de la más nueva a la más vieja, como en la app.
const sesion = (date, sets, extra = {}) => ({
  id: `s${++t}`, date, start: Date.parse(date + 'T10:00:00'),
  entries: [{ name: PRESS.name, cat: 'Pecho', sets, ...extra }],
});
const serie = (w, r, rpe) => ({ w, r, ...(rpe != null ? { rpe } : {}) });
const sinNaN = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN!' : v));

beforeEach(() => { S.sessions = []; S.cfg.unit = 'kg'; t = 0; });

describe('fuerzaPrevia', () => {
  it('sin historial no hay panel de fuerza', () => {
    expect(fuerzaPrevia(PRESS)).toBe(null);
  });

  it('1RM actual y cambio en la ventana de 8 semanas que termina en la última sesión', () => {
    S.sessions = [
      sesion('2026-09-20', [serie(50, 8)]),
      sesion('2026-09-06', [serie(47.5, 8)]),
      sesion('2026-08-01', [serie(45, 8)]),
      sesion('2026-06-01', [serie(30, 8)]), // fuera de la ventana: no entra
    ];
    const f = fuerzaPrevia(PRESS);
    const ult = e1rmSeries(PRESS.name).at(-1).y;
    expect(f.actual).toBe(Math.round(ult * 10) / 10);
    expect(f.puntos.map(p => p.date)).toEqual(['2026-08-01', '2026-09-06', '2026-09-20']);
    expect(f.cambioPct).toBe(11); // 50 contra 45: +11 %
    expect(f.semanas).toBe(7);    // 1 ago → 20 sep = 50 días
    expect(f.fecha).toBe('2026-09-20');
  });

  it('bajar también se dice: el cambio es negativo', () => {
    S.sessions = [sesion('2026-09-20', [serie(40, 8)]), sesion('2026-09-01', [serie(50, 8)])];
    expect(fuerzaPrevia(PRESS).cambioPct).toBe(-20);
  });

  it('con una sola sesión hay 1RM pero no cambio (nunca un "0 %" inventado)', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)])];
    const f = fuerzaPrevia(PRESS);
    expect(f.actual).toBeGreaterThan(0);
    expect(f.cambioPct).toBe(null);
    expect(f.semanas).toBe(null);
  });

  it('dos sesiones en la misma semana tampoco alcanzan para un cambio', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-17', [serie(47.5, 8)])];
    expect(fuerzaPrevia(PRESS).cambioPct).toBe(null);
  });

  it('la tendencia es la de trend() sobre la ventana (null con menos de 4 puntos)', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-06', [serie(47.5, 8)])];
    expect(fuerzaPrevia(PRESS).tendencia).toBe(null);
    S.sessions = ['2026-09-20', '2026-09-13', '2026-09-06', '2026-08-30'].map((d, i) => sesion(d, [serie(50 - i * 2.5, 8)]));
    expect(fuerzaPrevia(PRESS).tendencia.slope).toBeGreaterThan(0);
  });

  it('unilateral usa su propia serie, no la bilateral', () => {
    S.sessions = [sesion('2026-09-20', [serie(20, 8)], { unilateral: true }), sesion('2026-09-10', [serie(50, 8)])];
    expect(fuerzaPrevia(PRESS, { uni: true }).actual).toBeLessThan(30);
    expect(fuerzaPrevia(PRESS).actual).toBeGreaterThan(50);
  });
});

describe('sparkPuntos', () => {
  it('con menos de dos puntos no hay línea', () => {
    expect(sparkPuntos([])).toBe(null);
    expect(sparkPuntos([{ date: 'x', y: 50 }])).toBe(null);
    expect(sparkPuntos(null)).toBe(null);
  });
  it('escala al recuadro: el más alto arriba, el más bajo abajo', () => {
    const s = sparkPuntos([{ y: 40 }, { y: 50 }], { ancho: 100, alto: 40, margen: 0 });
    expect(s.points).toBe('0,40 100,0');
    expect(s.ultimo).toEqual({ x: 100, y: 0 });
  });
  it('una serie plana va al medio, sin NaN', () => {
    const s = sparkPuntos([{ y: 50 }, { y: 50 }, { y: 50 }], { ancho: 96, alto: 38 });
    expect(s.points).not.toMatch(/NaN/);
    expect(s.ultimo.y).toBe(19);
  });
});

describe('recordPrevia y haceTexto', () => {
  it('sin historial no hay récord', () => {
    expect(recordPrevia(PRESS)).toBe(null);
  });
  it('la mejor serie (peso × reps) y hace cuánto, igual que "Mejor serie" en Progreso', () => {
    S.sessions = [
      sesion('2026-09-20', [serie(47.5, 7), serie(47.5, 7)]),
      sesion('2026-09-06', [serie(50, 8)]),
      sesion('2026-08-30', [serie(52.5, 3)]),
    ];
    expect(recordPrevia(PRESS, { hoy: '2026-09-27' })).toEqual({ w: 50, r: 8, date: '2026-09-06', dias: 21, hace: 'hace 3 semanas' });
  });
  it('en empate cuenta la primera vez que se logró', () => {
    S.sessions = [sesion('2026-09-20', [serie(50, 8)]), sesion('2026-09-06', [serie(50, 8)])];
    expect(recordPrevia(PRESS, { hoy: '2026-09-27' }).date).toBe('2026-09-06');
  });
  it('haceTexto', () => {
    expect([0, 1, 5, 13, 14, 21, 59, 60, 400].map(haceTexto)).toEqual([
      'hoy', 'ayer', 'hace 5 días', 'hace 13 días', 'hace 2 semanas', 'hace 3 semanas', 'hace 8 semanas', 'hace 2 meses', 'hace 13 meses',
    ]);
    expect(haceTexto(null)).toBe('');
    expect(haceTexto(NaN)).toBe('');
  });
});

describe('recuperacionPrevia', () => {
  it('el grupo del ejercicio y su recuperación estimada', () => {
    S.sessions = [sesion(hace(1), [serie(50, 8, 9)])];
    const r = recuperacionPrevia(PRESS);
    expect(r.cat).toBe('Pecho');
    expect(r.dias).toBe(1);
    expect(r.pct).toBeGreaterThan(0);
    expect(r.pct).toBeLessThan(100);
  });
  it('sin historial del grupo, dias es null (la UI dice "sin registro", no un 100 % inventado)', () => {
    expect(recuperacionPrevia(PRESS)).toEqual({ cat: 'Pecho', pct: 100, dias: null });
  });
  it('un ejercicio sin grupo reconocible no tiene panel', () => {
    expect(recuperacionPrevia({ id: 'z', name: 'Qwerty' })).toBe(null);
  });
  it('nada devuelve NaN', () => {
    S.sessions = [sesion(hace(3), [serie(50, 8)])];
    expect(sinNaN([fuerzaPrevia(PRESS), recordPrevia(PRESS), recuperacionPrevia(PRESS)])).not.toContain('NaN!');
  });
});
