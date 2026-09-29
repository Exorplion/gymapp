// En modo prueba el respaldo automático también corre, con otro nombre
// (2026-09-29): antes no corría "para no confundir", y por eso las sesiones
// del 27 y 28 de Enzo no quedaron en ningún archivo.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { completeSession, registrarDiaEntrenado } from '../session.js';
import { exportJSON, nombreRespaldo } from '../backup.js';
import { toast } from '../toast.js';

let prueba = false;
vi.mock('../modoPrueba.js', () => ({ enModoPrueba: () => prueba }));
vi.mock('../backup.js', async orig => ({ ...(await orig()), exportJSON: vi.fn() }));
vi.mock('../db.js', () => ({ DB: {}, STORES: [], idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Posterior A', exercises: [{ id: 'a', name: 'Remo', sets: 1, reps: 8 }] }];
  S.sessions = [];
  S.cfg.lastBackupAt = Date.now();   // respaldo reciente: fuera de prueba no toca
  S.draft = { id: 'd1', slotId: 's1', dayName: 'Posterior A', start: Date.now() - 60000, entries: { a: { name: 'Remo', sets: [{ w: 40, r: 8 }] } }, order: ['a'] };
});

describe('nombreRespaldo', () => {
  it('la copia de prueba se baja con otro nombre', () => {
    expect(nombreRespaldo(true, '2026-09-27')).toBe('fierro-prueba-2026-09-27.json');
    expect(nombreRespaldo(false, '2026-09-27')).toBe('fierro-backup-2026-09-27.json');
  });
});

describe('respaldo al completar', () => {
  it('en prueba se respalda siempre, aunque el respaldo real sea reciente', async () => {
    prueba = true;
    await completeSession();
    await vi.waitFor(() => expect(exportJSON).toHaveBeenCalledWith({ auto: true }));
  });

  it('fuera de prueba sigue la regla de siempre (respaldo reciente: no baja nada)', async () => {
    prueba = false;
    await completeSession();
    await new Promise(r => setTimeout(r, 20));
    expect(exportJSON).not.toHaveBeenCalled();
  });
});

describe('anotar un día pasado en prueba', () => {
  it('el aviso dice que queda en la copia de prueba', async () => {
    prueba = true;
    await registrarDiaEntrenado('2026-09-27', 's1');
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('copia de prueba'));
  });
});
