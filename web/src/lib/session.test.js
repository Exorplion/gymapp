import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from './state.js';

vi.mock('./db.js', () => ({ idb: { put: vi.fn(), del: vi.fn() } }));
vi.mock('./rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('./alarm.js', () => ({ pedirPermiso: vi.fn() }));

import { startSession, completeSession, pendingSlot, ensureVals } from './session.js';
import { isBodyweight } from './equip.js';

describe('session.js — secuencia', () => {
  beforeEach(() => {
    S.routine = [
      { id: 'a', order: 0, type: 'workout', name: 'Anterior A', exercises: [{ id: 'e1', name: 'Press', sets: 1, reps: 8 }] },
      { id: 'b', order: 1, type: 'rest' },
      { id: 'c', order: 2, type: 'workout', name: 'Posterior', exercises: [{ id: 'e2', name: 'Remo', sets: 1, reps: 8 }] },
    ];
    S.cfg.seqIndex = 0; S.cfg.seqIndexDate = null;
    S.draft = null; S.sessions = [];
  });

  it('startSession abre el draft con slotId (no weekday)', async () => {
    await startSession(0);
    expect(S.draft.slotId).toBe('a');
    expect(S.draft.dayName).toBe('Anterior A');
  });

  it('completeSession avanza seqIndex al turno siguiente', async () => {
    await startSession(0);
    S.draft.entries['e1'] = { name: 'Press', sets: [{ w: 50, r: 8, t: Date.now() }] };
    await completeSession();
    expect(S.cfg.seqIndex).toBe(1); // pasa al descanso
  });

  it('guarda la sesión con el día en que se ENTRENÓ, no en el que se abrió', async () => {
    // Una PWA no se cierra, se suspende: un borrador abierto ayer (o el
    // martes y completado el jueves) quedaba archivado con la fecha vieja.
    await startSession(0);
    S.draft.date = '2000-01-01';              // el borrador viene de "antes"
    S.draft.start = Date.parse('2026-09-10T07:30:00');
    S.draft.entries['e1'] = { name: 'Press', sets: [{ w: 50, r: 8, t: S.draft.start }] };
    await completeSession();
    expect(S.sessions[0].date).toBe('2026-09-10');
  });

  it('pendingSlot() devuelve el turno en seqIndex', () => {
    S.cfg.seqIndex = 2;
    expect(pendingSlot().id).toBe('c');
  });
});

describe('peso corporal — dominadas y compañía (Enzo, 2026-09-09)', () => {
  beforeEach(() => {
    S.hoyVals = {};
    S.sessions = [];
    S.cfg.profile = { ...(S.cfg.profile || {}), weightKg: 78 };
  });

  it('isBodyweight reconoce el equipo declarado y el nombre del movimiento', () => {
    expect(isBodyweight({ name: 'Lo que sea', equip: 'corporal' })).toBe(true);
    expect(isBodyweight({ name: 'Dominadas' })).toBe(true);
    expect(isBodyweight({ name: 'Fondos en paralelas' })).toBe(true);
    expect(isBodyweight({ name: 'Plancha' })).toBe(true);
    // Equipo explícito distinto manda sobre el nombre: dominadas con lastre en
    // polea no son "tu cuerpo y nada más".
    expect(isBodyweight({ name: 'Dominadas', equip: 'polea' })).toBe(false);
    expect(isBodyweight({ name: 'Press banca', equip: 'barra' })).toBe(false);
  });

  it('un ejercicio de peso corporal sin historial arranca con tu peso, no con 20', () => {
    const v = ensureVals({ id: 'x1', name: 'Dominadas', reps: 8 });
    expect(v.w).toBe(78);
  });

  it('un ejercicio con carga externa sigue arrancando en 20', () => {
    const v = ensureVals({ id: 'x2', name: 'Press banca', equip: 'barra', reps: 8 });
    expect(v.w).toBe(20);
  });

  it('sin peso corporal registrado no se inventa uno', () => {
    S.cfg.profile = { ...(S.cfg.profile || {}), weightKg: null };
    const v = ensureVals({ id: 'x3', name: 'Fondos', reps: 8 });
    expect(v.w).toBe(0);
  });
});

/* El peso de partida que se declara en la edición de la rutina
   (`ex.pesoInicialKg`, Enzo 2026-09-21: "en la sesión en vivo tengo que
   poner los pesos de nuevo"). Lo que se fija acá es el LUGAR que ocupa en la
   cadena de ensureVals: reemplaza al default inventado, y nada más. */
describe('peso de partida declarado en la rutina', () => {
  beforeEach(() => {
    S.hoyVals = {};
    S.sessions = [];
    S.cfg.profile = { ...(S.cfg.profile || {}), weightKg: 78 };
  });

  it('sin historial, la rueda arranca en el peso declarado y no en los 20 de siempre', () => {
    const v = ensureVals({ id: 'd1', name: 'Press banca', equip: 'barra', reps: 8, pesoInicialKg: 45 });
    expect(v.w).toBe(45);
  });

  it('un ejercicio SIN el campo se comporta exactamente como antes', () => {
    expect(ensureVals({ id: 'd2', name: 'Press banca', equip: 'barra', reps: 8 }).w).toBe(20);
    expect(ensureVals({ id: 'd3', name: 'Dominadas', reps: 8 }).w).toBe(78);
  });

  it('0 y null son "sin declarar", no un peso: no pisan el default', () => {
    expect(ensureVals({ id: 'd4', name: 'Press banca', equip: 'barra', reps: 8, pesoInicialKg: 0 }).w).toBe(20);
    expect(ensureVals({ id: 'd5', name: 'Press banca', equip: 'barra', reps: 8, pesoInicialKg: null }).w).toBe(20);
  });

  it('en un ejercicio de peso corporal el declarado gana igual (ahí sabés lo que hacés)', () => {
    const v = ensureVals({ id: 'd6', name: 'Dominadas', reps: 8, pesoInicialKg: 85 });
    expect(v.w).toBe(85);
  });

  it('el historial le gana al declarado: el dato medido manda', () => {
    // Una sola serie de tres planificadas → la progresión no llega a
    // "subir_peso", así que el punto de partida es la última serie.
    S.sessions = [{ date: '2026-09-20', entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 60, r: 8 }] }] }];
    const v = ensureVals({ id: 'd7', name: 'Press banca', equip: 'barra', sets: 3, reps: 8, pesoInicialKg: 45 });
    expect(v.w).toBe(60);
  });

  it('la progresión le gana al declarado: si hoy toca subir, sube', () => {
    // Una serie planificada, hecha al tope del rango (8 + VENTANA = 11):
    // la doble progresión manda subir 2.5% → 61.5.
    S.sessions = [{ date: '2026-09-20', entries: [{ name: 'Press banca', equip: 'barra', sets: [{ w: 60, r: 11 }] }] }];
    const v = ensureVals({ id: 'd8', name: 'Press banca', equip: 'barra', sets: 1, reps: 8, pesoInicialKg: 45 });
    expect(v.w).toBe(61.5);
    expect(v.r).toBe(8);
  });
});
