import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { progresion, progresionTexto, VENTANA } from '../progression.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn() } }));

const EX = { name: 'Press banca', equip: 'barra', sets: 3, reps: 8 };
const sesionCon = sets => [{ date: '2026-09-08', entries: [{ name: 'Press banca', equip: 'barra', sets }] }];
const serie = (w, r) => ({ w, r });

beforeEach(() => { S.sessions = []; });

describe('progresion', () => {
  it('sin historial no dice nada — la primera vez no se progresa contra nada', () => {
    expect(progresion(EX)).toBe(null);
  });

  it('sin objetivo de reps no hay rango, así que no hay regla', () => {
    S.sessions = sesionCon([serie(60, 11), serie(60, 11), serie(60, 11)]);
    expect(progresion({ ...EX, reps: 0 })).toBe(null);
  });

  it('el rango sale del objetivo del ejercicio: piso = reps, tope = reps + ventana', () => {
    S.sessions = sesionCon([serie(60, 8)]);
    const p = progresion(EX);
    expect(p.piso).toBe(8);
    expect(p.tope).toBe(8 + VENTANA);
  });

  it('tope alcanzado en TODAS las series → subir el peso y volver al piso', () => {
    S.sessions = sesionCon([serie(60, 11), serie(60, 11), serie(60, 12)]);
    const p = progresion(EX);
    expect(p.accion).toBe('subir_peso');
    expect(p.peso).toBeGreaterThan(60);
    expect(progresionTexto(p)).toContain('volvé a 8');
  });

  it('una serie corta y NO se sube: el permiso lo da el rendimiento completo', () => {
    S.sessions = sesionCon([serie(60, 11), serie(60, 11), serie(60, 9)]);
    const p = progresion(EX);
    expect(p.accion).toBe('sostener');
    expect(p.peso).toBe(60);
  });

  it('ninguna serie en el tope → sumar reps, mismo peso', () => {
    S.sessions = sesionCon([serie(60, 8), serie(60, 8), serie(60, 7)]);
    const p = progresion(EX);
    expect(p.accion).toBe('sumar_reps');
    expect(p.peso).toBe(60);
    expect(progresionTexto(p)).toContain('sumá reps');
  });

  it('una serie de aproximación liviana NO cuenta para subir', () => {
    // El error clásico al implementar esto de apuro: la serie de 20 kg × 15
    // llegó al tope del rango, pero no dice nada sobre si 60 kg está
    // dominado. Contarla adelantaría la subida de peso.
    S.sessions = sesionCon([serie(20, 15), serie(60, 11), serie(60, 11), serie(60, 11)]);
    const p = progresion(EX);
    expect(p.pesoAnterior).toBe(60);
    expect(p.seriesTotales).toBe(3);
    expect(p.accion).toBe('subir_peso');
  });

  it('cortar la sesión a la mitad no habilita subir, aunque esas series lleguen al tope', () => {
    S.sessions = sesionCon([serie(60, 12), serie(60, 12)]); // 2 de las 3 planificadas
    expect(progresion(EX).accion).toBe('sostener');
  });

  it('mira la ÚLTIMA sesión, no un promedio', () => {
    S.sessions = [
      { date: '2026-09-08', entries: [{ name: 'Press banca', equip: 'barra', sets: [serie(60, 8), serie(60, 8), serie(60, 8)] }] },
      { date: '2026-09-01', entries: [{ name: 'Press banca', equip: 'barra', sets: [serie(60, 12), serie(60, 12), serie(60, 12)] }] },
    ];
    expect(progresion(EX).accion).toBe('sumar_reps');
  });

  it('el mismo movimiento en otra máquina es otro historial', () => {
    S.sessions = sesionCon([serie(60, 12), serie(60, 12), serie(60, 12)]);
    expect(progresion({ ...EX, equip: 'mancuernas' })).toBe(null);
  });
});
