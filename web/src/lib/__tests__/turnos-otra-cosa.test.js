// "Hoy hago otra cosa" y la regla del puntero (turnos universales, Fase 3).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S, resolveAutoRest } from '../state.js';
import { planDeLaSesion, desdeAlCerrar, avanzarPuntero, manana } from '../puntero.js';
import { opcionesDelDia } from '../descansoHoy.js';
import {
  startSession, startSessionLibre, addSessionExercise, completeSession, indiceHoy, elegirTurnoHoy,
  fueraDelPlanHoy, sessionExs,
} from '../session.js';
import { ultimaVezDeTurno } from '../entreno.js';
import { arrancar, semana } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../persist.js', () => ({ tocaAutoBackup: () => false }));

const DIA = { lun: '2026-10-12', mar: '2026-10-13', mie: '2026-10-14', jue: '2026-10-15', vie: '2026-10-16' };
const enDia = d => vi.setSystemTime(new Date(`${d}T10:00:00`));

/** Una serie en el primer ejercicio de la sesión y cerrarla. */
async function hacerYCerrar() {
  const ex = sessionExs(indiceHoy())[0];
  S.draft.start = Date.now();
  S.draft.entries[ex.id] = { name: ex.name, sets: [{ w: 50, r: 10, t: Date.now() }] };
  await completeSession();
  S.sessionComplete = null;
}

describe('planDeLaSesion (la tabla de la spec, §5)', () => {
  const rutina = semana();   // A · P · R · A · P · R · R
  it('el turno que toca: dentro del plan', () => {
    expect(planDeLaSesion({ routine: rutina, seqIndex: 1, index: 1 })).toEqual({ slotIndex: 1 });
  });
  it('otro turno en un día de entrenamiento: fuera, en vez del que tocaba', () => {
    const p = planDeLaSesion({ routine: rutina, seqIndex: 1, index: 0, ciclo: 3 });
    expect(p).toEqual({ fueraDePlan: true, reemplaza: { slotId: 's1', turnoId: 's1', nombre: 'Posterior', ciclo: 3 } });
  });
  it('sesión libre en un día de entrenamiento: fuera, en vez del que tocaba', () => {
    expect(planDeLaSesion({ routine: rutina, seqIndex: 1, index: -1 }).reemplaza.nombre).toBe('Posterior');
  });
  it('en un descanso, el que sigue es "adelantar" (dentro del plan)', () => {
    expect(planDeLaSesion({ routine: rutina, seqIndex: 2, index: 3 })).toEqual({ slotIndex: 3 });
  });
  it('en un descanso, otro turno o una sesión libre: fuera, sin reemplazar nada', () => {
    expect(planDeLaSesion({ routine: rutina, seqIndex: 2, index: 4 })).toEqual({ fueraDePlan: true, reemplaza: null });
    expect(planDeLaSesion({ routine: rutina, seqIndex: 2, index: -1 })).toEqual({ fueraDePlan: true, reemplaza: null });
  });
  it('desdeAlCerrar: fuera del plan avanza desde lo que tocaba, o no se mueve', () => {
    expect(desdeAlCerrar({ routine: rutina, draft: { slotId: 's0', fueraDePlan: true, reemplaza: { slotId: 's1' } } })).toBe(1);
    expect(desdeAlCerrar({ routine: rutina, draft: { slotId: 's0', fueraDePlan: true, reemplaza: null } })).toBe(null);
    expect(desdeAlCerrar({ routine: rutina, draft: { slotId: 's3' } })).toBe(3);
  });
  it('avanzarPuntero deja la fecha en mañana y cuenta la vuelta', () => {
    const cfg = { seqIndex: 6 };
    avanzarPuntero(cfg, 7, 6, '2026-10-31');
    expect(cfg).toEqual({ seqIndex: 0, seqIndexDate: '2026-11-01', ciclo: 1 });
    expect(manana('2026-12-31')).toBe('2027-01-01');
  });
});

describe('la semana de Enzo con una sesión fuera del plan', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); elegirTurnoHoy(null); });

  it('martes Pull libre → miércoles descanso, jueves Anterior, viernes Posterior', async () => {
    enDia(DIA.mar);
    await arrancar(semana(), { cfg: { seqIndex: 1, seqIndexDate: DIA.mar } });
    expect(S.routine[S.cfg.seqIndex].name).toBe('Posterior');

    await startSessionLibre('Pull con Juan');
    expect(indiceHoy()).toBe(-1);
    await addSessionExercise({ name: 'Dominadas', sets: 3, reps: 8 });
    await hacerYCerrar();
    const pull = S.sessions[0];
    expect(pull).toMatchObject({ dayName: 'Pull con Juan', slotId: null, libre: true, fueraDePlan: true });
    expect(pull.reemplaza).toMatchObject({ slotId: 's1', nombre: 'Posterior' });
    expect(pull.turnoId).toBeUndefined();
    expect(S.cfg.seqIndex).toBe(2);   // el día se usó: la semana sigue
    expect(S.cfg.seqIndexDate).toBe(DIA.mie);

    enDia(DIA.mie); await resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].type).toBe('rest');
    enDia(DIA.jue); await resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].name).toBe('Anterior');
    await startSession(S.cfg.seqIndex);
    await hacerYCerrar();
    enDia(DIA.vie); await resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].name).toBe('Posterior');
    // La sesión libre no es Posterior: su "última vez" no cambió.
    expect(ultimaVezDeTurno(S.routine[1])).toBe(null);
  });

  it('dentro del plan el descanso también es del día siguiente (antes se salteaba)', async () => {
    enDia(DIA.mar);
    await arrancar(semana(), { cfg: { seqIndex: 1, seqIndexDate: DIA.mar } });
    await startSession(1);
    await hacerYCerrar();
    expect(S.sessions[0].fueraDePlan).toBeUndefined();
    await resolveAutoRest();   // recargar esa misma noche no la pisa
    expect(S.cfg.seqIndexDate).toBe(DIA.mie);
    enDia(DIA.mie); await resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].type).toBe('rest');
  });

  it('otro de tus turnos en un día de entrenamiento: cuenta para ESE turno', async () => {
    enDia(DIA.mar);
    await arrancar(semana(), { cfg: { seqIndex: 1, seqIndexDate: DIA.mar } });
    elegirTurnoHoy(0);   // Anterior en vez de Posterior
    expect(indiceHoy()).toBe(0);
    expect(fueraDelPlanHoy()).toEqual({ nombre: 'Posterior' });
    await startSession(indiceHoy());
    await hacerYCerrar();
    expect(S.sessions[0]).toMatchObject({ slotId: 's0', fueraDePlan: true, reemplaza: { nombre: 'Posterior' } });
    expect(S.cfg.seqIndex).toBe(2);
    expect(ultimaVezDeTurno(S.routine[3])).toBe(DIA.mar);   // Anterior, en sus dos apariciones
    expect(ultimaVezDeTurno(S.routine[1])).toBe(null);
    expect(indiceHoy()).toBe(2);   // la elección era para esa sesión
  });

  it('en un descanso, otro turno no mueve la semana; el que sigue sí', async () => {
    enDia(DIA.mie);
    await arrancar(semana(), { cfg: { seqIndex: 2, seqIndexDate: DIA.mie } });
    elegirTurnoHoy(4);   // Posterior: no es el que sigue
    await startSession(indiceHoy());
    await hacerYCerrar();
    expect(S.cfg.seqIndex).toBe(2);
    expect(S.sessions[0].reemplaza).toBe(null);

    elegirTurnoHoy(3);   // Anterior: el que sigue → adelantar
    await startSession(indiceHoy());
    await hacerYCerrar();
    expect(S.sessions[0].fueraDePlan).toBeUndefined();
    expect(S.cfg.seqIndex).toBe(4);
  });
});

/** Las dos apariciones de cada turno con el mismo turnoId (unificadas). */
const unificada = () => semana().map(f => (f.type === 'workout' ? { ...f, turnoId: f.name[0] } : f));

describe('opcionesDelDia', () => {
  it('en un día de entrenamiento no ofrece el que tocaba, ni lo marca recomendado', () => {
    const o = opcionesDelDia({ routine: unificada(), seqIndex: 1, sessions: [], hoy: DIA.mar });
    expect(o.opciones.map(x => x.nombre)).toEqual(['Anterior']);
    expect(o.opciones[0].recomendado).toBe(false);
    expect(o.recomendado).toBe(null);
  });
  it('en un descanso es lo de siempre', () => {
    const o = opcionesDelDia({ routine: unificada(), seqIndex: 2, sessions: [], hoy: DIA.mie });
    expect(o.opciones.map(x => x.nombre)).toEqual(['Anterior', 'Posterior']);
    expect(o.recomendado.nombre).toBe('Anterior');
  });
});
