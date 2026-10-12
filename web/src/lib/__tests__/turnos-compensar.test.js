// Cerrar la semana (turnos universales, Fase 4) contra la sesión de verdad:
// la propuesta en Hoy, "Sumar a hoy" hacia el borrador y "Hoy no".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { S, resolveAutoRest } from '../state.js';
import {
  startSession, startSessionLibre, addSessionExercise, completeSession, indiceHoy, sessionExs, targetSets,
  compensacionHoy, compensacionAceptada, compensacionDescartada, aceptarCompensacion, descartarCompensacion,
  deshacerCompensacion, conCompensacion, elegirTurnoHoy,
} from '../session.js';
import { arrancar, semana } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../persist.js', () => ({ tocaAutoBackup: () => false }));

const DIA = { mar: '2026-10-13', jue: '2026-10-15', vie: '2026-10-16' };
const enDia = d => vi.setSystemTime(new Date(`${d}T10:00:00`));

/** Todas las series de la sesión abierta, y cerrarla. */
async function hacerTodoYCerrar() {
  S.draft.start = Date.now();
  for (const ex of sessionExs(indiceHoy())) {
    S.draft.entries[ex.id] = { name: ex.name, sets: Array.from({ length: targetSets(ex) }, () => ({ w: 40, r: 10, t: Date.now() })) };
  }
  await completeSession();
  S.sessionComplete = null;
}

/** Martes "Pull con Juan" en vez de Posterior; jueves Anterior en el plan. */
async function hastaElViernes() {
  enDia(DIA.mar);
  await arrancar(semana(), { cfg: { seqIndex: 1, seqIndexDate: DIA.mar } });
  await startSessionLibre('Pull con Juan');
  await addSessionExercise({ name: 'Curl con barra', sets: 4, reps: 10 });
  await hacerTodoYCerrar();
  enDia(DIA.jue); await resolveAutoRest();
}

describe('cerrar la semana en Hoy', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); elegirTurnoHoy(null); });

  it('el jueves no propone nada (el viernes Posterior vuelve a cargar todo); el viernes, +2 y +2', async () => {
    await hastaElViernes();
    expect(S.routine[S.cfg.seqIndex].name).toBe('Anterior');
    expect(compensacionHoy().hoy).toEqual([]);
    await startSession(S.cfg.seqIndex);
    await hacerTodoYCerrar();

    enDia(DIA.vie); await resolveAutoRest();
    expect(S.routine[S.cfg.seqIndex].name).toBe('Posterior');
    const c = compensacionHoy();
    expect(c.hoy.map(h => [h.nombre, h.mas])).toEqual([['Remo', 2], ['Curl femoral', 2]]);
  });

  it('"Sumar a hoy" va al borrador y no cambia la rutina', async () => {
    await hastaElViernes();
    await startSession(S.cfg.seqIndex); await hacerTodoYCerrar();
    enDia(DIA.vie); await resolveAutoRest();
    const rutinaAntes = JSON.stringify(S.routine);
    const turnosAntes = JSON.stringify(S.turnos);
    const c = compensacionHoy();
    const remo = c.hoy.find(h => h.nombre === 'Remo');
    await aceptarCompensacion(c, [remo.id]);   // destildó el curl femoral
    expect(compensacionAceptada(compensacionHoy())).toEqual([remo]);

    const plan = conCompensacion(S.routine[S.cfg.seqIndex].exercises, compensacionAceptada(compensacionHoy()));
    expect(plan.find(e => e.name === 'Remo')).toMatchObject({ sets: 6, _mas: 2 });

    await startSession(S.cfg.seqIndex);
    expect(S.draft.extraSets).toEqual({ [remo.exId]: 2 });
    expect(compensacionHoy()).toBe(null);   // con la sesión abierta no se muestra
    expect(JSON.stringify(S.routine)).toBe(rutinaAntes);
    expect(JSON.stringify(S.turnos)).toBe(turnosAntes);
  });

  it('"Hoy no" deja la sesión exactamente como el plan, y se puede deshacer', async () => {
    await hastaElViernes();
    await startSession(S.cfg.seqIndex); await hacerTodoYCerrar();
    enDia(DIA.vie); await resolveAutoRest();
    const c = compensacionHoy();
    await descartarCompensacion(c);
    expect(compensacionDescartada(compensacionHoy())).toBe(true);
    await deshacerCompensacion();
    expect(compensacionDescartada(compensacionHoy())).toBe(false);
    await descartarCompensacion(c);
    await startSession(S.cfg.seqIndex);
    expect(S.draft.extraSets).toEqual({});
    expect(S.draft.extras).toEqual([]);
  });

  it('lo traído para compensar no se ofrece para fijar en la rutina', async () => {
    await hastaElViernes();
    const i = S.cfg.seqIndex;
    S.cfg.compensar = {
      clave: `${S.cfg.ciclo || 0}:${S.routine[i].id}`,
      items: [{ id: 't:x', tipo: 'traer', zona: 'Femoral', desde: 'Posterior', ex: { name: 'Curl femoral', sets: 2, reps: 12 } }],
    };
    await startSession(i);
    expect(S.draft.extras).toEqual([expect.objectContaining({ name: 'Curl femoral', sets: 2, compensa: true })]);
    await hacerTodoYCerrar();
    expect(S.sessions[0].added).toBeUndefined();
    expect(S.sessions[0].entries.map(e => e.name)).toContain('Curl femoral');
  });

  it('si ya entrenaste hoy, no propone nada', async () => {
    await hastaElViernes();
    await startSession(S.cfg.seqIndex); await hacerTodoYCerrar();
    expect(compensacionHoy()).toBe(null);
  });
});
