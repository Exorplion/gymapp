// Asistente "Agregar ejercicio" en 3 pasos (spec 2026-09-27 §1): la lógica
// pura. El criterio de aprobación que se prueba acá: "el ejercicio queda donde
// se lo dejó", en la rutina Y en el orden de la sesión.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import * as A from '../asistente-agregar.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

const {
  PASOS, estadoInicial, setNombre, setGrupo, setCampo, ajustar,
  necesitaGrupo, grupoDe, avanzar, volver, rangoReps, textoCTA, datosParaGuardar,
} = A;

const conNombre = (tipo, name, cat = '') => setGrupo(setNombre(estadoInicial(tipo), name), cat);

describe('estado del asistente', () => {
  it('arranca en el paso 1 de 3, sin posición elegida', () => {
    const e = estadoInicial('sesion');
    expect(PASOS).toBe(3);
    expect(e).toMatchObject({ tipo: 'sesion', paso: 1, posicion: null });
    expect(e.form).toMatchObject({ name: '', cat: '', sets: 3, reps: 10, equip: '', unilateral: false });
  });

  it('sin nombre no avanza y dice qué falta', () => {
    const { estado, error } = avanzar(estadoInicial('rutina'));
    expect(estado.paso).toBe(1);
    expect(error).toMatch(/ejercicio/);
  });

  it('con nombre detectable pasa al paso 2 sin pedir el grupo', () => {
    const e = setNombre(estadoInicial('rutina'), 'Remo en polea');
    expect(necesitaGrupo(e.form)).toBe(false);
    expect(grupoDe(e.form)).toBe('Espalda');
    expect(avanzar(e).estado.paso).toBe(2);
  });

  it('si la detección falla pide el grupo, y con el grupo elegido avanza', () => {
    const e = setNombre(estadoInicial('rutina'), 'Movimiento raro');
    expect(necesitaGrupo(e.form)).toBe(true);
    expect(avanzar(e).error).toMatch(/grupo/);
    const conGrupo = setGrupo(e, 'Hombro');
    expect(grupoDe(conGrupo.form)).toBe('Hombro');
    expect(avanzar(conGrupo).estado.paso).toBe(2);
  });

  it('un grupo elegido a mano se descarta si el nombre pasa a ser detectable', () => {
    const e = setNombre(setGrupo(setNombre(estadoInicial('rutina'), 'Movimiento raro'), 'Hombro'), 'Press banca');
    expect(e.form.cat).toBe('');
    expect(grupoDe(e.form)).toBe('Pecho');
  });

  it('cambiar el nombre o el grupo vuelve a la posición sugerida', () => {
    const e = { ...setNombre(estadoInicial('rutina'), 'Press banca'), posicion: 4 };
    expect(setNombre(e, 'Remo').posicion).toBeNull();
    expect(setGrupo(e, 'Pecho').posicion).toBeNull();
  });

  it('no pasa del paso 3 ni baja del 1; volver no borra nada', () => {
    let e = setNombre(estadoInicial('rutina'), 'Press banca');
    e = avanzar(avanzar(avanzar(e).estado).estado).estado;
    expect(e.paso).toBe(3);
    e = volver(volver(volver(e)));
    expect(e.paso).toBe(1);
    expect(e.form.name).toBe('Press banca');
  });

  it('los steppers no bajan de 1 ni pasan el tope', () => {
    let e = estadoInicial('rutina');
    e = ajustar(ajustar(ajustar(e, 'sets', -1), 'sets', -1), 'sets', -1);
    expect(e.form.sets).toBe(1);
    e = setCampo(e, 'sets', 10);
    expect(ajustar(e, 'sets', 1).form.sets).toBe(10);
    expect(ajustar(setCampo(e, 'reps', 50), 'reps', 1).form.reps).toBe(50);
  });

  it('el rango de reps es el de la doble progresión (piso + VENTANA)', () => {
    expect(rangoReps(8)).toEqual({ piso: 8, tope: 11, texto: '8–11' });
  });

  it('el CTA dice a dónde va', () => {
    expect(textoCTA('rutina')).toBe('Agregar a la rutina');
    expect(textoCTA('sesion')).toBe('Agregar a la sesión');
  });

  it('guarda cat sólo si se eligió a mano', () => {
    expect(datosParaGuardar(conNombre('rutina', ' Press banca ').form)).toMatchObject({ name: 'Press banca', cat: '' });
    expect(datosParaGuardar(conNombre('rutina', 'Movimiento raro', 'Hombro').form).cat).toBe('Hombro');
  });
});

const ctxDe = (tipo, nombreTurno, movibles, fijos = []) => ({ tipo, nombreTurno, fijos, movibles });
const f = (id, name, sets = 3, estado = 'pendiente') => ({ id, name, sets, estado });

describe('sugerencias del paso 1', () => {
  it('autocompleta del catálogo sin repetir lo ya escrito entero', () => {
    const r = A.autocompletar('remo');
    expect(r).toContain('Remo con barra');
    expect(r.length).toBeLessThanOrEqual(6);
    expect(A.autocompletar('Remo con barra')).not.toContain('Remo con barra');
    expect(A.autocompletar('   ')).toEqual([]);
  });

  it('explorar un grupo da su catálogo sin lo que ya está', () => {
    const r = A.catalogoDe('Pecho', ['press banca']);
    expect(r).toContain('Aperturas en polea');
    expect(r).not.toContain('Press banca');
  });

  it('te falta hoy: el grupo con menos series planificadas del turno', () => {
    const ctx = ctxDe('rutina', 'Anterior A', [
      f('a', 'Press banca', 4), f('b', 'Press inclinado', 4), f('c', 'Elevaciones laterales', 3), f('d', 'Extensión tríceps polea', 2),
    ]);
    const r = A.teFaltaHoy(ctx);
    expect(r.cat).toBe('Tríceps');
    expect(r.ejercicios.length).toBeGreaterThan(0);
    expect(r.ejercicios.length).toBeLessThanOrEqual(3);
    expect(r.ejercicios).not.toContain('Extensión tríceps polea');
  });

  it('un grupo que el nombre del turno promete y no tiene ejercicios es el que falta', () => {
    const ctx = ctxDe('rutina', 'Pecho / Tríceps', [f('a', 'Press banca', 4), f('b', 'Aperturas en polea', 3)]);
    expect(A.teFaltaHoy(ctx).cat).toBe('Tríceps');
  });

  it('en la sesión no cuenta lo salteado', () => {
    // Sin el salteado, Bíceps (3) le ganaría a Espalda (4).
    const ctx = ctxDe('sesion', 'Tirón', [f('a', 'Remo con barra', 4)], [f('b', 'Curl con barra', 3, 'salteado')]);
    expect(A.teFaltaHoy(ctx).cat).toBe('Espalda');
  });

  it('turno vacío y sin nombre reconocible: nada que sugerir', () => {
    expect(A.teFaltaHoy(ctxDe('rutina', 'Día 3', []))).toBeNull();
  });
});
