import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { previewDayDrop } from '../rutina-logic.js';

const dia = (wd, name) => ({ weekday: wd, name, exercises: [{ id: 'x' + wd, name: 'Press', sets: 4, reps: 10 }] });
const libre = wd => ({ weekday: wd, name: '', exercises: [] });
const semanaLibre = () => ({ 1: libre(1), 2: libre(2), 3: libre(3), 4: libre(4), 5: libre(5), 6: libre(6), 0: libre(0) });

describe('previewDayDrop', () => {
  beforeEach(() => {
    S.routine = semanaLibre();
    S.cfg.dayDrop = 'ask';
  });

  it('destino libre: sólo se muda el origen', () => {
    S.routine[1] = dia(1, 'Push');
    expect(previewDayDrop(1, 4)).toEqual({ 1: 4 });
  });

  it('destino ocupado con "ask" previsualiza el corrimiento al próximo día libre', () => {
    S.routine[1] = dia(1, 'Push');
    S.routine[2] = dia(2, 'Pull');
    // Push va al martes; Pull se corre al primer libre después del martes: miércoles
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 3 });
  });

  it('con dayDrop="swap" previsualiza el intercambio', () => {
    S.cfg.dayDrop = 'swap';
    S.routine[1] = dia(1, 'Push');
    S.routine[2] = dia(2, 'Pull');
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 1 });
  });

  it('con la semana llena el corrimiento degenera en intercambio', () => {
    [1, 2, 3, 4, 5, 6, 0].forEach(wd => { S.routine[wd] = dia(wd, 'D' + wd); });
    expect(previewDayDrop(1, 2)).toEqual({ 1: 2, 2: 1 });
  });

  it('soltar sobre sí mismo o arrastrar un día libre no previsualiza nada', () => {
    S.routine[1] = dia(1, 'Push');
    expect(previewDayDrop(1, 1)).toEqual({});
    expect(previewDayDrop(2, 1)).toEqual({});
  });

  it('acepta weekdays como string, igual que los data-sid del DOM', () => {
    S.routine[1] = dia(1, 'Push');
    expect(previewDayDrop('1', '4')).toEqual({ 1: 4 });
  });
});
