// Prueba de humo del arnés de tests: si esto corre, vitest está bien montado.
// Cubre las utilidades de format.js de las que dependen los helpers de sesión
// (dstr) y de nutrición (round1, norm).
import { describe, it, expect } from 'vitest';
import { dstr, round1, fmtNum, norm } from '../format.js';

describe('format', () => {
  it('dstr formatea una fecha como YYYY-MM-DD en hora local', () => {
    expect(dstr(new Date(2026, 7, 4))).toBe('2026-08-04');
    expect(dstr(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('round1 redondea a un decimal', () => {
    expect(round1(62.449)).toBe(62.4);
    expect(round1(62.45)).toBe(62.5);
  });

  it('fmtNum no le pone decimal a los enteros', () => {
    expect(fmtNum(62)).toBe('62');
    expect(fmtNum(62.5)).toBe('62.5');
  });

  it('norm saca acentos, mayúsculas y espacios de los bordes', () => {
    expect(norm('  Plátano ')).toBe('platano');
    expect(norm('Ají de Gallina')).toBe('aji de gallina');
  });
});
