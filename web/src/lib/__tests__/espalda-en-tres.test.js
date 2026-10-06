import { describe, it, expect } from 'vitest';
import { zonasDeEjercicio, zonaDeForma, recuperacion, seriesPorZona, cabezasTriceps, ZONAS } from '../recuperacion.js';
import { nombreZona } from '../inicio.js';

// Enzo, 2026-10-06: "espalda no es un grupo en general, tiene trapecios y
// dorsales". La recuperación la parte en tres zonas con su propio %; el
// tríceps queda en una, con una lectura de sus cabezas.
describe('la espalda en tres zonas', () => {
  it('ya no hay una "Espalda" entera en la recuperación', () => {
    expect(ZONAS).not.toContain('Espalda');
    expect(ZONAS).toEqual(expect.arrayContaining(['Trapecio', 'Romboides', 'Dorsal ancho', 'Lumbares']));
  });

  it('cada ejercicio va a lo que trabaja', () => {
    expect(zonasDeEjercicio({ name: 'Jalón al pecho' })).toEqual(['Dorsal ancho']);
    expect(zonasDeEjercicio({ name: 'Dominadas' })).toEqual(['Dorsal ancho']);
    expect(zonasDeEjercicio({ name: 'Remo neutro' })).toEqual(['Romboides']);
    expect(zonasDeEjercicio({ name: 'Encogimientos' })).toEqual(['Trapecio']);
    expect(zonasDeEjercicio({ name: 'Remo espalda alta' })).toEqual(['Trapecio', 'Romboides']);
    expect(zonasDeEjercicio({ name: 'Remo con barra' })).toEqual(['Romboides', 'Dorsal ancho']);
  });

  it('el peso muerto carga la espalda de sostén: trapecio y lumbares', () => {
    expect(zonasDeEjercicio({ name: 'Peso muerto' })).toEqual(['Trapecio', 'Lumbares']);
  });

  it('uno de espalda que no se reconoce va a romboides y dorsal, como un remo', () => {
    expect(zonasDeEjercicio({ name: 'Máquina rara', cat: 'Espalda' })).toEqual(['Romboides', 'Dorsal ancho']);
  });

  it('cada parte del dibujo pinta su zona', () => {
    expect(zonaDeForma('Espalda', 'trapezius')).toBe('Trapecio');
    expect(zonaDeForma('Espalda', 'upperBack')).toBe('Romboides');
    expect(zonaDeForma('Espalda', 'lats')).toBe('Dorsal ancho');
    expect(zonaDeForma('Lumbares', 'lowerBack')).toBe('Lumbares');
    expect(zonaDeForma('Tríceps', 'tricepsLong')).toBe('Tríceps');
  });

  it('cada zona tiene nombre para mostrar', () => {
    expect(nombreZona('Dorsal ancho')).toBe('Dorsal ancho');
    expect(nombreZona('Romboides')).toBe('Romboides');
    expect(nombreZona('Trapecio')).toBe('Trapecio');
  });

  it('un jalón ayer no frena el trapecio', () => {
    const t = new Date('2026-10-01T18:00:00').getTime();
    const s = { id: 's', date: '2026-09-30', start: t - 25 * 3600000, end: t - 24 * 3600000, entries: [{ name: 'Jalón al pecho', sets: [{ w: 50, r: 10, t: t - 24 * 3600000 }, { w: 50, r: 10, t: t - 24 * 3600000 }] }] };
    const r = recuperacion([s], t);
    expect(r['Dorsal ancho']).not.toBe(null);
    expect(r.Trapecio).toBe(null);
    expect(seriesPorZona([s], '2026-09-28')['Dorsal ancho']).toBe(2);
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
