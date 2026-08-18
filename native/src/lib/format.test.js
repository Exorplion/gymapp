import { dstr, fmtD, fmtDFull, fmtNum, round1, kg2lb, lb2kg, fmtMMSS, norm, KG2LB } from './format.js';

describe('format.js — portado de web/src/lib/format.js', () => {
  it('dstr formatea YYYY-MM-DD', () => {
    expect(dstr(new Date('2026-08-18T12:00:00'))).toBe('2026-08-18');
  });
  it('fmtD muestra día + mes corto', () => {
    expect(fmtD('2026-08-18')).toBe('18 ago');
  });
  it('fmtDFull agrega el día de semana', () => {
    expect(fmtDFull('2026-08-18')).toBe('Mar 18 ago');
  });
  it('round1 redondea a un decimal', () => {
    expect(round1(74.26)).toBe(74.3);
  });
  it('fmtNum no muestra decimales si es entero', () => {
    expect(fmtNum(75)).toBe('75');
    expect(fmtNum(74.5)).toBe('74.5');
  });
  it('kg2lb y lb2kg son inversas entre sí (con margen de redondeo)', () => {
    expect(round1(lb2kg(kg2lb(80)))).toBe(80);
  });
  it('KG2LB es la constante de conversión estándar', () => {
    expect(KG2LB).toBeCloseTo(2.20462262, 5);
  });
  it('fmtMMSS formatea segundos como m:ss', () => {
    expect(fmtMMSS(90)).toBe('1:30');
    expect(fmtMMSS(65)).toBe('1:05');
  });
  it('norm normaliza mayúsculas y acentos para comparar texto', () => {
    expect(norm('Press Banca')).toBe('press banca');
    expect(norm('SENTADILLA')).toBe('sentadilla');
  });
});
