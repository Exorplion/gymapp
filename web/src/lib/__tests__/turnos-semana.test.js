// "Tu semana" (turnos universales, Fase 2): mover, agregar y sacar paradas
// con descansos explícitos y el puntero seguido por id de slot.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { esVinculado } from '../turnos.js';
import {
  moverParada, ordenarSemana, agregarParada, sacarParada, sacarTurnoDeSemana, crearTurno,
  acomodarDescansos, rachaMasLarga, turnosGuardados, vecesEnSemana, nombreOcupado, saveSlot, undoRutina,
} from '../rutina-logic.js';
import { arrancar, recargar, disco, filasCompatibles, semana, w, r, ex } from './turnos-base.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));

const letras = () => S.routine.map(s => (s.type === 'rest' ? 'R' : s.name[0])).join('');
const pendiente = () => S.routine[S.cfg.seqIndex].id;

describe('mover una parada', () => {
  beforeEach(() => arrancar(semana(), { cfg: { seqIndex: 3 } }));   // hoy: Anterior del jueves (s3)

  it('no cambia los descansos ni lo que te toca hoy', async () => {
    await moverParada(4, 1);   // Posterior del viernes pasa después del descanso
    expect(letras()).toBe('APRARPR');
    expect(pendiente()).toBe('s3');
    await moverParada(3, -1);  // y el Anterior pendiente un lugar antes
    expect(letras()).toBe('APARRPR');
    expect(pendiente()).toBe('s3');
    expect(S.cfg.seqIndex).toBe(2);
  });

  it('arrastrar (ordenarSemana) sigue al pendiente y queda en disco', async () => {
    await ordenarSemana(['s2', 's0', 's1', 's3', 's4', 's5', 's6']);
    expect(letras()).toBe('RAPAPRR');
    expect(pendiente()).toBe('s3');
    const d = await disco();
    expect(d.routine.map(f => f.id)).toEqual(['s2', 's0', 's1', 's3', 's4', 's5', 's6']);
    expect(d.settings.cfg.seqIndex).toBe(3);
    expect(filasCompatibles(d)).toBe(true);
  });

  it('A·P·R·A·P·R·R se arma desde cero, parada por parada', async () => {
    await arrancar([], {});
    S.turnos = [];
    const a = await crearTurno();
    await saveSlot(a, { name: 'Anterior' });
    const p = await crearTurno();
    await saveSlot(p, { name: 'Posterior' });
    const ta = S.routine[0].turnoId, tp = S.routine[1].turnoId;
    await agregarParada(null);
    await agregarParada(ta);
    await agregarParada(tp);
    await agregarParada(null);
    await agregarParada(null);
    expect(letras()).toBe('APRAPRR');
    expect(S.routine[3].exercises).toBe(S.routine[0].exercises);
    expect(S.turnos).toHaveLength(2);
    await recargar();
    expect(letras()).toBe('APRAPRR');
    expect(esVinculado(S.routine[4])).toBe(true);
  });
});

describe('agregar', () => {
  beforeEach(() => arrancar(semana(), { cfg: { seqIndex: 3 } }));

  it('un turno que ya existe queda vinculado: editar uno cambia todos', async () => {
    const tp = S.routine[1].turnoId;
    const i = await agregarParada(tp, 2);
    expect(i).toBe(2);
    expect(letras()).toBe('APPRAPRR');
    expect(vecesEnSemana(tp)).toBe(3);
    expect(S.routine[2].exercises).toBe(S.routine[1].exercises);
    expect(pendiente()).toBe('s3');   // se agregó antes del pendiente: el índice se corre, el día no
  });

  it('un turno nuevo tiene nombre libre y ningún ejercicio', async () => {
    await crearTurno();
    await crearTurno();
    expect(S.routine.slice(-2).map(s => s.name)).toEqual(['Turno nuevo', 'Turno nuevo 2']);
    expect(S.turnos).toHaveLength(4);
  });
});

describe('sacar', () => {
  beforeEach(() => arrancar(semana(), { cfg: { seqIndex: 3 } }));

  it('sacar una de dos apariciones deja el turno en la otra', async () => {
    await sacarParada(4);
    expect(letras()).toBe('APRARR');
    expect(S.turnos).toHaveLength(2);
    expect(turnosGuardados()).toEqual([]);
  });

  it('sacar la última aparición la guarda por defecto, y se vuelve a insertar con sus ejercicios', async () => {
    const tp = S.routine[1].turnoId;
    await sacarParada(4);
    await sacarParada(1);
    expect(letras()).toBe('ARARR');
    expect(turnosGuardados().map(t => t.name)).toEqual(['Posterior']);
    await recargar();
    expect(turnosGuardados().map(t => t.name)).toEqual(['Posterior']);   // sobrevive a recargar
    await agregarParada(tp, 1);
    expect(letras()).toBe('APRARR');
    expect(S.routine[1].exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo']);
  });

  it('borrarla saca el turno, y deshacer lo devuelve', async () => {
    await sacarParada(4);
    await sacarParada(1, { guardar: false });
    expect(S.turnos.map(t => t.name)).toEqual(['Anterior']);
    await undoRutina();
    expect(letras()).toBe('APRARR');
    expect(S.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(esVinculado(S.routine[1])).toBe(true);
  });

  it('sacar la pendiente deja como pendiente la que quedó en su lugar', async () => {
    await sacarParada(3);
    expect(pendiente()).toBe('s4');
  });

  it('no saca la parada con una sesión abierta', async () => {
    S.draft = { slotId: 's1', entries: [] };
    expect(await sacarParada(1)).toBe(false);
    expect(await sacarTurnoDeSemana(S.routine[1].turnoId)).toBe(false);
    expect(letras()).toBe('APRAPRR');
    S.draft = null;
  });

  it('sacar el turno de la semana saca todas sus apariciones y lo guarda', async () => {
    await sacarTurnoDeSemana(S.routine[1].turnoId);
    expect(letras()).toBe('ARARR');
    expect(turnosGuardados().map(t => t.name)).toEqual(['Posterior']);
  });
});

describe('deshacer sigue a "Hoy"', () => {
  beforeEach(() => arrancar(semana(), { cfg: { seqIndex: 3 } }));

  it('deshacer un movimiento no cambia lo que te toca', async () => {
    await moverParada(0, 1);
    await undoRutina();
    expect(letras()).toBe('APRAPRR');
    expect(pendiente()).toBe('s3');
    expect(S.cfg.seqIndex).toBe(3);
  });
});

describe('acomodar descansos', () => {
  it('A·P·A·P sin descansos → A·P·R·A·P·R·R (Posterior tiene pierna)', async () => {
    const piernas = [ex('p1', 'Curl femoral', 3, { cat: 'Pierna' })];
    await arrancar([
      w('a', 0, 'Anterior', [ex('a1', 'Press plano', 4)]), w('p', 1, 'Posterior', piernas),
      w('a2', 2, 'Anterior', [ex('a3', 'Press plano', 4)]), w('p2', 3, 'Posterior', [ex('p3', 'Curl femoral', 3, { cat: 'Pierna' })]),
    ], { cfg: { seqIndex: 2 } });
    await acomodarDescansos();
    expect(letras()).toBe('APRAPRR');
    expect(pendiente()).toBe('a2');
    await undoRutina();
    expect(letras()).toBe('APAP');
  });
});

describe('avisos y nombres', () => {
  beforeEach(() => arrancar(semana()));

  it('rachaMasLarga da la vuelta al ciclo', () => {
    expect(rachaMasLarga()).toBe(2);
    expect(rachaMasLarga([w('a', 0, 'A', []), r('x', 1), w('b', 2, 'B', []), w('c', 3, 'C', [])])).toBe(3);
  });

  it('un nombre repetido se rechaza, el propio no', async () => {
    expect(nombreOcupado('posterior')).toBe(true);
    expect(nombreOcupado('Posterior', S.routine[1].turnoId)).toBe(false);
    expect(await saveSlot(0, { name: 'Posterior' })).toBe(false);
    expect(S.routine[0].name).toBe('Anterior');
    expect(await saveSlot(0, { name: 'Empuje' })).toBe(true);
    expect(S.routine[3].name).toBe('Empuje');
  });
});
