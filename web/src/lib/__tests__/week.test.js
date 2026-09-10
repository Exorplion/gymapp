import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { semanaDe, diasSinRegistro, lunesDe } from '../week.js';
import { registrarDiaEntrenado } from '../session.js';
import { dstr } from '../format.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn() }));
vi.mock('../carousel.js', () => ({ scrollCarouselTo: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

// La semana real de Enzo, la que destapó todo esto: entrenó el martes y el
// jueves, y descansó el miércoles. Jueves 2026-09-10.
const LUN = '2026-09-07', MAR = '2026-09-08', MIE = '2026-09-09', JUE = '2026-09-10';

beforeEach(() => {
  S.sessions = [];
  S.routine = [
    { id: 's1', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 3, reps: 8 }] },
    { id: 's2', order: 1, type: 'workout', name: 'Posterior A', exercises: [{ id: 'e2', name: 'Remo', sets: 3, reps: 8 }] },
    { id: 's3', order: 2, type: 'workout', name: 'Pierna', exercises: [{ id: 'e3', name: 'Sentadilla', sets: 3, reps: 8 }] },
  ];
  S.cfg.seqIndex = 0;
  S.cfg.seqIndexDate = null;
});

describe('semanaDe', () => {
  it('devuelve los 7 días de lunes a domingo', () => {
    const dias = semanaDe(JUE);
    expect(dias).toHaveLength(7);
    expect(dias[0].fecha).toBe(LUN);
    expect(dias[0].etiqueta).toBe('Lun');
    expect(dias[6].etiqueta).toBe('Dom');
  });

  it('marca los días en que DE VERDAD se entrenó, no los que la rutina suponía', () => {
    S.sessions = [{ id: 'a', date: JUE, dayName: 'Posterior A' }, { id: 'b', date: MAR, dayName: 'Anterior A' }];
    const porFecha = Object.fromEntries(semanaDe(JUE).map(d => [d.fecha, d.sesiones.length]));
    expect(porFecha[LUN]).toBe(0);   // no entrenó el lunes, aunque sea el turno 1
    expect(porFecha[MAR]).toBe(1);
    expect(porFecha[MIE]).toBe(0);
    expect(porFecha[JUE]).toBe(1);
  });

  it('distingue "todavía no llegó" de "no entrenaste"', () => {
    const dias = semanaDe(JUE);
    expect(dias.find(d => d.fecha === MIE).esFuturo).toBe(false);
    expect(dias.find(d => d.fecha === '2026-09-11').esFuturo).toBe(true);
    expect(dias.find(d => d.fecha === JUE).esHoy).toBe(true);
  });

  it('lunesDe cae en lunes cualquiera sea el día que se le pase', () => {
    for (const f of [LUN, MAR, MIE, JUE, '2026-09-13']) {
      expect(new Date(dstr(lunesDe(f)) + 'T12:00:00').getDay()).toBe(1);
    }
  });
});

describe('diasSinRegistro', () => {
  it('lista sólo los días pasados y vacíos, sin hoy ni el futuro', () => {
    S.sessions = [{ id: 'b', date: MAR, dayName: 'Anterior A' }];
    expect(diasSinRegistro(JUE).map(d => d.fecha)).toEqual([MIE, LUN]);
  });
});

describe('registrarDiaEntrenado', () => {
  it('anota el turno elegido en ese día, sin inventar series ni duración', async () => {
    const sess = await registrarDiaEntrenado(MAR, 's1');
    expect(sess.date).toBe(MAR);
    expect(sess.dayName).toBe('Anterior A');
    expect(sess.entries).toEqual([]);   // no se sabe con qué pesos: no se inventa
    expect(sess.duration).toBe(null);   // tampoco cuánto duró
    expect(sess.retro).toBe(true);
  });

  it('el día queda marcado en la semana', async () => {
    await registrarDiaEntrenado(MAR, 's1');
    expect(semanaDe(JUE).find(d => d.fecha === MAR).sesiones).toHaveLength(1);
  });

  it('avanza el puntero al turno siguiente cuando es la sesión más reciente', async () => {
    await registrarDiaEntrenado(MAR, 's1');
    expect(S.cfg.seqIndex).toBe(1);
  });

  it('NO hace retroceder el puntero al anotar un día viejo', async () => {
    // El caso real: ya entrenaste el jueves (Posterior A, puntero en Pierna) y
    // recién ahí te acordás de anotar el martes. Si esto moviera el puntero al
    // turno siguiente del martes, la app te haría repetir Posterior A.
    S.sessions = [{ id: 'x', date: JUE, slotId: 's2', dayName: 'Posterior A' }];
    S.cfg.seqIndex = 2;
    await registrarDiaEntrenado(MAR, 's1');
    expect(S.cfg.seqIndex).toBe(2);
  });

  it('no registra el futuro', async () => {
    expect(await registrarDiaEntrenado('2099-01-01', 's1')).toBe(null);
  });

  it('no duplica el mismo turno el mismo día', async () => {
    await registrarDiaEntrenado(MAR, 's1');
    expect(await registrarDiaEntrenado(MAR, 's1')).toBe(null);
    expect(S.sessions.filter(s => s.date === MAR)).toHaveLength(1);
  });

  it('un turno que no existe no se registra', async () => {
    expect(await registrarDiaEntrenado(MAR, 'no-existe')).toBe(null);
  });

  it('deja S.sessions ordenado por fecha descendente', async () => {
    S.sessions = [{ id: 'x', date: JUE, slotId: 's2' }];
    await registrarDiaEntrenado(MAR, 's1');
    const fechas = S.sessions.map(s => s.date);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });
});
