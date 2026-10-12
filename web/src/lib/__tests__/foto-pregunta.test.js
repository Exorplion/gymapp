import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { tocaOfrecerFoto, fotoOfrecida, fotoRechazada, fotoHecha } from '../fotoPregunta.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn(), get: vi.fn() } }));

const polea = { id: 'p', name: 'Remo neutro', equip: 'polea' };

beforeEach(() => {
  S.cfg = { activeGym: 'g1' };
  S.gyms = [{ id: 'g1', name: 'Smart', equip: {} }];
});

describe('cuándo se ofrece la foto de la máquina', () => {
  it('en la primera serie de un ejercicio de máquina sin máquinas armadas', () => {
    expect(tocaOfrecerFoto(polea, 0)).toBe(true);
  });

  it('no en la segunda serie', () => {
    expect(tocaOfrecerFoto(polea, 1)).toBe(false);
  });

  it('en unilateral, cuando se completa la primera serie (fila 1)', () => {
    expect(tocaOfrecerFoto(polea, 0, { uni: true })).toBe(false);
    expect(tocaOfrecerFoto(polea, 1, { uni: true })).toBe(true);
  });

  it('no en ejercicios que no dependen de la máquina', () => {
    expect(tocaOfrecerFoto({ name: 'Press', equip: 'barra' }, 0)).toBe(false);
    expect(tocaOfrecerFoto({ name: 'Curl', equip: 'mancuernas' }, 0)).toBe(false);
  });

  it('sin gimnasio elegido también se ofrece (la foto crea uno)', () => {
    S.cfg.activeGym = null;
    expect(tocaOfrecerFoto(polea, 0)).toBe(true);
  });

  it('no si ya tiene máquinas armadas en ese gym', () => {
    S.gyms[0].maquinas = { 'remo neutro': [{ id: 'm1', nombre: 'Polea' }] };
    expect(tocaOfrecerFoto(polea, 0)).toBe(false);
  });

  it('"Ahora no" no vuelve a preguntar por ese ejercicio', async () => {
    await fotoRechazada('Remo neutro');
    expect(tocaOfrecerFoto(polea, 0)).toBe(false);
    expect(tocaOfrecerFoto({ ...polea, name: 'Jalón' }, 0)).toBe(true);
  });

  it('con la foto sacada no vuelve a preguntar', async () => {
    await fotoHecha('Remo neutro');
    expect(tocaOfrecerFoto(polea, 0)).toBe(false);
  });

  it('ignorada dos veces, deja de preguntar', async () => {
    await fotoOfrecida('Remo neutro');
    expect(tocaOfrecerFoto(polea, 0)).toBe(true);
    await fotoOfrecida('Remo neutro');
    expect(tocaOfrecerFoto(polea, 0)).toBe(false);
  });
});
