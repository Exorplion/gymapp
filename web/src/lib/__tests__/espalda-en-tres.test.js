import { describe, it, expect } from 'vitest';
import { zonasDeEjercicio, zonaDeForma, recuperacion, seriesPorZona, cabezasTriceps, dorsalPorRegion, ZONAS } from '../recuperacion.js';
import { nombreZona } from '../inicio.js';

// Enzo, 2026-10-06: "espalda no es un grupo en general, tiene trapecios y
// dorsales". La recuperación la parte en tres zonas con su propio %; el
// tríceps queda en una, con una lectura de sus cabezas.
describe('la espalda en tres zonas', () => {
  it('ya no hay una "Espalda" entera en la recuperación', () => {
    expect(ZONAS).not.toContain('Espalda');
    expect(ZONAS).toEqual(expect.arrayContaining(['Trapecio', 'Romboides', 'Dorsal', 'Lumbares']));
  });

  it('cada ejercicio va a lo que trabaja', () => {
    expect(zonasDeEjercicio({ name: 'Jalón al pecho' })).toEqual(['Dorsal']);
    expect(zonasDeEjercicio({ name: 'Dominadas' })).toEqual(['Dorsal']);
    expect(zonasDeEjercicio({ name: 'Remo neutro' })).toEqual(['Dorsal']);
    expect(zonasDeEjercicio({ name: 'Remo con barra' })).toEqual(['Dorsal']);
    expect(zonasDeEjercicio({ name: 'Encogimientos' })).toEqual(['Trapecio']);
  });

  it('con los codos abiertos es espalda media, no dorsal', () => {
    expect(zonasDeEjercicio({ name: 'Remo espalda alta' })).toEqual(['Romboides']);
    expect(zonasDeEjercicio({ name: 'Kelso shrug' })).toEqual(['Romboides']);
  });

  it('el peso muerto carga la espalda de sostén: trapecio y lumbares', () => {
    expect(zonasDeEjercicio({ name: 'Peso muerto' })).toEqual(['Trapecio', 'Lumbares']);
  });

  it('uno de espalda que no se reconoce va al dorsal', () => {
    expect(zonasDeEjercicio({ name: 'Máquina rara', cat: 'Espalda' })).toEqual(['Dorsal']);
  });

  it('cada parte del dibujo pinta su zona: las dos del dorsal, un mismo %', () => {
    expect(zonaDeForma('Espalda', 'trapezius')).toBe('Trapecio');
    expect(zonaDeForma('Espalda', 'upperBack')).toBe('Dorsal');
    expect(zonaDeForma('Espalda', 'lats')).toBe('Dorsal');
    expect(zonaDeForma('Lumbares', 'lowerBack')).toBe('Lumbares');
    expect(zonaDeForma('Tríceps', 'tricepsLong')).toBe('Tríceps');
  });

  it('cada zona tiene nombre para mostrar', () => {
    expect(nombreZona('Dorsal')).toBe('Dorsal');
    expect(nombreZona('Romboides')).toBe('Romboides');
    expect(nombreZona('Trapecio')).toBe('Trapecio');
  });

  it('un jalón ayer no frena el trapecio', () => {
    const t = new Date('2026-10-01T18:00:00').getTime();
    const s = { id: 's', date: '2026-09-30', start: t - 25 * 3600000, end: t - 24 * 3600000, entries: [{ name: 'Jalón al pecho', sets: [{ w: 50, r: 10, t: t - 24 * 3600000 }, { w: 50, r: 10, t: t - 24 * 3600000 }] }] };
    const r = recuperacion([s], t);
    expect(r.Dorsal).not.toBe(null);
    expect(r.Trapecio).toBe(null);
    expect(seriesPorZona([s], '2026-09-28').Dorsal).toBe(2);
  });
});

describe('dorsal por región', () => {
  const ses = (date, name, n) => ({ id: date + name, date, entries: [{ name, sets: Array.from({ length: n }, () => ({ w: 40, r: 10 })) }] });
  it('alto (remos en polea), bajo (jalón, dominadas) y los dos (remo con barra)', () => {
    const s = [ses('2026-10-05', 'Remo en polea', 3), ses('2026-10-05', 'Jalón al pecho', 4), ses('2026-10-06', 'Dominadas', 2), ses('2026-10-06', 'Remo con barra', 3)];
    expect(dorsalPorRegion(s, '2026-10-05')).toEqual({ alto: 3, bajo: 6, ambos: 3 });
  });
  it('lo de espalda media no suma al dorsal', () => {
    expect(dorsalPorRegion([ses('2026-10-06', 'Kelso shrug', 3)], '2026-10-05')).toEqual({ alto: 0, bajo: 0, ambos: 0 });
  });
});

describe('cabezas del tríceps', () => {
  const ses = (date, name, n) => ({ id: date + name, date, entries: [{ name, sets: Array.from({ length: n }, () => ({ w: 20, r: 10 })) }] });

  it('separa lo que se hace con el brazo arriba (cabeza larga) del resto', () => {
    const s = [ses('2026-10-05', 'Extensión sobre cabeza', 3), ses('2026-10-06', 'Pushdown', 4), ses('2026-10-06', 'JM press', 2)];
    expect(cabezasTriceps(s, '2026-10-05')).toEqual({ larga: 3, resto: 6 });
  });

  it('no cuenta lo de antes del lunes ni lo que no es tríceps', () => {
    const s = [ses('2026-10-01', 'Pushdown', 4), ses('2026-10-06', 'Press banca', 4)];
    expect(cabezasTriceps(s, '2026-10-05')).toEqual({ larga: 0, resto: 0 });
  });
});
