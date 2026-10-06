import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { ventana, fuerzaPorEjercicio, indiceDeFuerza, resumenFuerza, recordsRecientes, semanasDeConstancia } from '../progreso.js';

const HOY = '2026-10-06';
let n = 0;
/** Una sesión con [nombre, peso, reps] — una serie por ejercicio. */
function ses(date, ...ejs) {
  const start = new Date(date + 'T07:00:00').getTime();
  return { id: `s${n++}`, date, start, end: start + 3600000, entries: ejs.map(([name, w, r]) => ({ name, sets: [{ w, r }] })) };
}

beforeEach(() => { n = 0; S.sessions = []; });

describe('ventana', () => {
  it('sin sesiones, null', () => {
    expect(ventana(HOY)).toBe(null);
  });
  it('desde la primera sesión si hay menos de 8 semanas', () => {
    S.sessions = [ses('2026-09-15', ['Press banca', 60, 8])];
    expect(ventana(HOY)).toEqual({ desde: '2026-09-15', semanas: 3 });
  });
  it('como mucho 8 semanas atrás', () => {
    S.sessions = [ses('2026-05-01', ['Press banca', 60, 8])];
    expect(ventana(HOY).desde).toBe('2026-08-11');
  });
});

describe('fuerza por ejercicio', () => {
  // Más nueva primero, como S.sessions en la app.
  const historia = () => [
    ses('2026-10-05', ['Press banca', 70, 8], ['Remo', 50, 8], ['Curl', 12, 10]),
    ses('2026-09-28', ['Press banca', 67.5, 8], ['Remo', 50, 8]),
    ses('2026-09-14', ['Press banca', 65, 8], ['Remo', 50, 8], ['Curl', 12, 10]),
    ses('2026-09-01', ['Press banca', 60, 8], ['Remo', 52.5, 8]),
  ];

  it('clasifica: sube, baja, y "nuevo" sin dos semanas entre base y última', () => {
    S.sessions = historia();
    S.sessions.unshift(ses('2026-10-06', ['Sentadilla', 100, 5]), ses('2026-10-01', ['Sentadilla', 95, 5]));
    const por = Object.fromEntries(fuerzaPorEjercicio('2026-09-01').map(e => [e.name, e.estado]));
    expect(por['Press banca']).toBe('sube');
    expect(por.Remo).toBe('baja');
    expect(por.Curl).toBe('igual');
    expect(por.Sentadilla).toBe('nuevo');
  });

  it('la base es la última sesión ANTES de la ventana si existe', () => {
    S.sessions = historia();
    const press = fuerzaPorEjercicio('2026-09-10').find(e => e.name === 'Press banca');
    expect(press.base.date).toBe('2026-09-01');
    expect(press.delta).toBeGreaterThan(0);
  });

  it('el índice arranca en 100 y termina en el promedio de los cambios', () => {
    S.sessions = historia();
    const ejs = fuerzaPorEjercicio('2026-09-01');
    const ind = indiceDeFuerza(ejs);
    expect(ind[0].y).toBe(100);
    const validos = ejs.filter(e => e.estado !== 'nuevo');
    const esperado = Math.round((validos.reduce((a, e) => a + e.ult.y / e.base.y, 0) / validos.length) * 1000) / 10;
    expect(ind[ind.length - 1].y).toBe(esperado);
  });

  it('el resumen cuenta y no inventa un % con un solo punto', () => {
    S.sessions = [ses('2026-10-05', ['Press banca', 70, 8])];
    const r = resumenFuerza(HOY);
    expect(r.pct).toBe(null);
    S.sessions = historia();
    const r2 = resumenFuerza(HOY);
    expect(r2.cuenta).toEqual({ sube: 1, igual: 1, baja: 1, nuevo: 0 });
    expect(typeof r2.pct).toBe('number');
  });
});

describe('récords y constancia', () => {
  it('récords del mes: cada mejora contra lo anterior, el más nuevo primero', () => {
    S.sessions = [
      ses('2026-10-05', ['Press banca', 70, 8]),
      ses('2026-09-20', ['Press banca', 65, 8]),
      ses('2026-08-01', ['Press banca', 60, 8]),
    ];
    const r = recordsRecientes(30, HOY);
    expect(r.map(x => [x.date, x.w])).toEqual([['2026-10-05', 70], ['2026-09-20', 65]]);
  });
  it('el mapa arma columnas de 7 empezando en lunes', () => {
    const dias = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'].map(date => ({ date, status: 'done' }));
    const sem = semanasDeConstancia(dias); // 1 oct 2026 es jueves
    expect(sem[0].slice(0, 3).every(d => d.status === 'fuera')).toBe(true);
    expect(sem[0][3].date).toBe('2026-10-01');
    expect(sem[1][0].date).toBe('2026-10-05');
  });
});
