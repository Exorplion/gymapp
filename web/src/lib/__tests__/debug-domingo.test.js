// Reproducción del bug 2 (2026-09-29, rama debug/datos-y-domingo — sólo
// diagnóstico, SIN arreglo): "si toco el calendario no me deja registrar que
// entrené un domingo".
//
// La única entrada al registro retroactivo es la tira de Inicio (SemanaReal),
// que pinta semanaDe(): lunes a domingo de la semana de HOY. Un lunes o un
// martes, el domingo de ayer/anteayer pertenece a la semana ANTERIOR y no está
// en la tira; el "Dom" que sí está es el domingo que viene (futuro,
// deshabilitado). Estos tests FALLAN a propósito con el código actual: dicen
// lo que Enzo espera (poder anotar los días pasados recientes), no cómo
// arreglarlo.
import { describe, it, expect, vi } from 'vitest';
import { S } from '../state.js';
import { semanaDe, diasSinRegistro } from '../week.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));

const alcanzables = hoy => semanaDe(hoy).filter(d => !d.esFuturo && !d.esHoy).map(d => d.fecha);

describe('bug 2 — el domingo anterior no se puede anotar', () => {
  it('martes 29-sep: el domingo 27 (anteayer) es alcanzable desde la tira', () => {
    S.sessions = [];
    expect(alcanzables('2026-09-29')).toContain('2026-09-27');
  });

  it('lunes 28-sep: el domingo 27 (ayer) figura como día sin registrar', () => {
    S.sessions = [];
    expect(diasSinRegistro('2026-09-28').map(d => d.fecha)).toContain('2026-09-27');
  });

  it('martes 29-sep: el "Dom" de la tira es un domingo pasado, no el que viene', () => {
    S.sessions = [];
    const dom = semanaDe('2026-09-29').find(d => d.etiqueta === 'Dom');
    expect(dom.esFuturo).toBe(false);
  });
});
