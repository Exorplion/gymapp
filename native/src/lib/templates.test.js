import { S } from './state.js';
import { TEMPLATES, applyTemplate } from './templates.js';
import { idb } from './db.js';

jest.mock('./db.js', () => ({ idb: { put: jest.fn(), clear: jest.fn(), del: jest.fn(), all: jest.fn() } }));

describe('templates', () => {
  beforeEach(() => {
    S.routine = [];
    S.cfg.routineName = '';
    S.rutOpen = null;
    S.rutMode = 'view';
    S.sheet = null;
  });

  it('TEMPLATES no está vacío y cada entrada tiene la forma esperada', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const t of TEMPLATES) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.days).toBe('string');
      expect(typeof t.who).toBe('string');
      expect(typeof t.freq).toBe('string');
      expect(Array.isArray(t.secuencia)).toBe(true);
      expect(t.secuencia.length).toBeGreaterThan(0);
      for (const [name, list] of t.secuencia) {
        expect(typeof name).toBe('string');
        expect(Array.isArray(list)).toBe(true);
        for (const [n, sets, reps] of list) {
          expect(typeof n).toBe('string');
          expect(typeof sets).toBe('number');
          expect(typeof reps).toBe('number');
        }
      }
    }
  });

  it('applyTemplate con id válido y sin split previo aplica directo (sin turnos, no pide confirmación)', async () => {
    await applyTemplate('fullbody');
    const t = TEMPLATES.find(x => x.id === 'fullbody');
    expect(S.cfg.routineName).toBe(t.name);
    expect(S.routine.length).toBe(t.secuencia.length);
    expect(S.routine[0].type).toBe('workout');
    expect(S.routine[0].name).toBe(t.secuencia[0][0]);
    expect(S.routine[0].exercises.length).toBe(t.secuencia[0][1].length);
    expect(S.rutOpen).toBe(0);
    expect(S.rutMode).toBe('view');
    expect(S.sheet).toBeNull();
  });

  it('applyTemplate con split ya cargado pide confirmación (openSheet) y no reemplaza hasta confirmar', async () => {
    S.routine = [{ id: 'x', order: 0, type: 'workout', name: 'Viejo', exercises: [{ id: 'e', name: 'Sentadilla', sets: 3, reps: 8 }] }];
    S.cfg.routineName = 'Viejo';
    await applyTemplate('ppl');
    // No se reemplazó todavía: se abrió un sheet de confirmación en su lugar.
    expect(S.cfg.routineName).toBe('Viejo');
    expect(S.sheet).toEqual(expect.objectContaining({ type: 'confirm' }));
    // Confirmar corre la aplicación real.
    await S.sheet.props.onConfirm();
    const t = TEMPLATES.find(x => x.id === 'ppl');
    expect(S.cfg.routineName).toBe(t.name);
    expect(S.routine.length).toBe(t.secuencia.length);
  });

  it('applyTemplate con id inexistente no hace nada (no explota, no muta S.routine)', async () => {
    S.routine = [{ id: 'x', order: 0, type: 'workout', name: 'Viejo', exercises: [] }];
    S.cfg.routineName = 'Viejo';
    await expect(applyTemplate('no-existe')).resolves.toBeUndefined();
    expect(S.routine).toEqual([{ id: 'x', order: 0, type: 'workout', name: 'Viejo', exercises: [] }]);
    expect(S.cfg.routineName).toBe('Viejo');
  });
});
