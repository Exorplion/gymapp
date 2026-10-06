import { describe, it, expect } from 'vitest';
import { recuperacion, zonasDeEjercicio, ventanaHoras, estadoDe, zonaDeForma, cuandoLista, ZONAS } from '../recuperacion.js';

const H = 3600000;
const AHORA = new Date('2026-10-01T18:00:00').getTime();

/** Una sesión que terminó hace `horas`, con entradas [nombre, nSeries, rpe?]. */
function sesion(horas, entradas, extra = {}) {
  const t = AHORA - horas * H;
  return {
    id: 's' + horas, date: new Date(t).toISOString().slice(0, 10), start: t - H, end: t, dayName: extra.dayName || 'Día',
    entries: entradas.map(([name, n, rpe = null, uni = false]) => ({
      name, unilateral: uni, sets: Array.from({ length: n }, () => ({ w: 50, r: 10, t, rpe })),
    })),
  };
}

describe('zonasDeEjercicio', () => {
  it('parte Pierna en cuádriceps y femoral', () => {
    expect(zonasDeEjercicio({ name: 'Leg press' })).toEqual(['Cuádriceps']);
    expect(zonasDeEjercicio({ name: 'Curl femoral sentado' })).toEqual(['Femoral']);
    expect(zonasDeEjercicio({ name: 'Press banca' })).toEqual(['Pecho']);
  });
  it('un ejercicio sin grupo no va a ninguna zona', () => {
    expect(zonasDeEjercicio({ name: 'Qwerty' })).toEqual([]);
  });
});

describe('recuperacion', () => {
  it('sin historial cada zona es null (sin dato), no 100 %', () => {
    const r = recuperacion([], AHORA);
    expect(ZONAS.every(z => r[z] === null)).toBe(true);
  });

  it('sube con las horas, no a saltos de un día', () => {
    const a = recuperacion([sesion(12, [['Press banca', 6]])], AHORA).Pecho.pct;
    const b = recuperacion([sesion(24, [['Press banca', 6]])], AHORA).Pecho.pct;
    const c = recuperacion([sesion(36, [['Press banca', 6]])], AHORA).Pecho.pct;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(100);
  });

  it('al fallo tarda más que con reps en reserva', () => {
    const fallo = recuperacion([sesion(30, [['Press banca', 6, 10]])], AHORA).Pecho.pct;
    const margen = recuperacion([sesion(30, [['Press banca', 6, 6]])], AHORA).Pecho.pct;
    expect(fallo).toBeLessThan(margen);
  });

  it('más series, más tiempo', () => {
    const pocas = recuperacion([sesion(30, [['Press banca', 3]])], AHORA).Pecho.pct;
    const muchas = recuperacion([sesion(30, [['Press banca', 12]])], AHORA).Pecho.pct;
    expect(muchas).toBeLessThan(pocas);
  });

  it('el femoral de ayer no frena a los cuádriceps de hace 80 horas', () => {
    const r = recuperacion([sesion(20, [['Curl femoral', 6]]), sesion(80, [['Leg press', 6]])], AHORA);
    expect(r.Femoral.pct).toBeLessThan(60);
    expect(r.Cuádriceps.pct).toBe(100);
  });

  it('cuenta sólo la sesión más reciente de cada zona', () => {
    const r = recuperacion([sesion(100, [['Press banca', 6]]), sesion(10, [['Press banca', 2]])], AHORA);
    expect(r.Pecho.horas).toBeCloseTo(10, 5);
  });

  it('un unilateral cuenta series, no filas', () => {
    const r = recuperacion([sesion(10, [['Curl martillo', 6, null, true]])], AHORA);
    expect(r.Bíceps.series).toBe(3);
  });

  it('nunca pasa de 100 ni da NaN', () => {
    const r = recuperacion([sesion(500, [['Press banca', 30, 10]])], AHORA);
    expect(r.Pecho.pct).toBe(100);
    const sinT = { id: 'x', date: '2026-09-30', entries: [{ name: 'Press banca', sets: [{ w: 1, r: 1 }] }] };
    expect(Number.isFinite(recuperacion([sinT], AHORA).Pecho.pct)).toBe(true);
  });

  it('trae lo que la cargó', () => {
    const r = recuperacion([sesion(10, [['Remo con barra', 3, 9], ['Jalón al pecho', 3, 10]], { dayName: 'Posterior B' })], AHORA);
    const d = r.Dorsal;
    expect(d.dayName).toBe('Posterior B');
    expect(d.ejercicios.map(e => e.name)).toEqual(['Remo con barra', 'Jalón al pecho']);
    expect(d.series).toBe(6);
    expect(d.listaEn).toBeGreaterThan(AHORA);
  });
});

describe('piezas chicas', () => {
  it('estados', () => {
    expect([0, 59, 60, 89, 90, 100].map(estadoDe)).toEqual(['cargado', 'cargado', 'recuperando', 'recuperando', 'listo', 'listo']);
  });
  it('ventana de un músculo grande > uno chico', () => {
    expect(ventanaHoras('Dorsal', 6, 2)).toBeGreaterThan(ventanaHoras('Bíceps', 6, 2));
  });
  it('las formas de la pierna en la lámina', () => {
    expect(zonaDeForma('Pierna', 'hamstring')).toBe('Femoral');
    expect(zonaDeForma('Pierna', 'innerQuad')).toBe('Cuádriceps');
    expect(zonaDeForma('Pecho', 'chest')).toBe('Pecho');
    expect(zonaDeForma(null, 'head')).toBe(null);
  });
  it('cuándo queda lista', () => {
    expect(cuandoLista(AHORA - 1, AHORA)).toBe('al 100 %');
    expect(cuandoLista(AHORA + 5 * H, AHORA)).toBe('al 100 % en 5 h');
    expect(cuandoLista(new Date('2026-10-02T09:00:00').getTime(), AHORA)).toBe('al 100 % mañana a la mañana');
    expect(cuandoLista(new Date('2026-10-03T15:00:00').getTime(), AHORA)).toBe('al 100 % el sábado');
  });
});

// 2026-10-03: la tarjeta de Inicio y el mapa muestran primero lo del turno
// que toca, y el mapa suma las series de la semana y una proyección.
import { zonasDeTurno, seriesPorZona, momentos } from '../recuperacion.js';
import { haceTexto, diasDesde } from '../inicio.js';

describe('zonasDeTurno', () => {
  it('junta las zonas de los ejercicios, sin repetir y en el orden de ZONAS', () => {
    const slot = { exercises: [{ name: 'Curl femoral sentado' }, { name: 'Jalón al pecho' }, { name: 'Remo con barra' }] };
    expect(zonasDeTurno(slot)).toEqual(['Dorsal', 'Femoral']);
  });
  it('sin turno o sin ejercicios reconocidos, ninguna', () => {
    expect(zonasDeTurno(null)).toEqual([]);
    expect(zonasDeTurno({ exercises: [{ name: 'Qwerty' }] })).toEqual([]);
  });
});

describe('seriesPorZona', () => {
  const ses = (date, entradas) => ({ date, entries: entradas.map(([name, n, uni = false]) => ({ name, unilateral: uni, sets: Array.from({ length: n }, () => ({ w: 1, r: 1 })) })) });
  it('cuenta desde la fecha dada, inclusive', () => {
    const r = seriesPorZona([ses('2026-09-28', [['Press banca', 4]]), ses('2026-09-27', [['Press banca', 9]])], '2026-09-28');
    expect(r.Pecho).toBe(4);
  });
  it('trae todas las zonas, con 0 las que no se tocaron', () => {
    const r = seriesPorZona([], '2026-09-28');
    expect(Object.keys(r)).toEqual(ZONAS);
    expect(Object.values(r).every(n => n === 0)).toBe(true);
  });
  it('en unilaterales un par de lados es una serie', () => {
    const r = seriesPorZona([ses('2026-09-29', [['Curl femoral sentado', 6, true]])], '2026-09-28');
    expect(r.Femoral).toBe(3);
  });
});

describe('momentos', () => {
  it('a la mañana: ahora, esta noche y los dos días siguientes', () => {
    const m = momentos(new Date('2026-10-03T10:00:00').getTime());
    expect(m.map(x => x.etiqueta)).toEqual(['Ahora', 'Noche', 'Domingo', 'Lunes']);
    expect(m[1].horas).toBe(12);
    expect(m[3].texto).toBe('el lunes a esta hora');
  });
  it('a la noche ya no hay "esta noche": pasa a "en 12 h"', () => {
    const m = momentos(new Date('2026-10-03T21:30:00').getTime());
    expect(m[1]).toMatchObject({ etiqueta: 'En 12 h', horas: 12 });
  });
});

describe('haceTexto', () => {
  it('hoy, ayer y hace N días', () => {
    expect(haceTexto('2026-10-03', '2026-10-03')).toBe('hoy');
    expect(haceTexto('2026-10-02', '2026-10-03')).toBe('ayer');
    expect(haceTexto('2026-09-30', '2026-10-03')).toBe('hace 3 días');
    expect(diasDesde('2026-10-05', '2026-10-03')).toBe(0);
  });
});
