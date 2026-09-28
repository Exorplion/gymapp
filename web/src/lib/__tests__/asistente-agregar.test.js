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

const ex = (id, name, extra = {}) => ({ id, name, sets: 3, reps: 10, ...extra });
const NUEVO = '__nuevo';

describe('paso 2: dónde va (rutina)', () => {
  // Turno guardado DESORDENADO a propósito: lo que se ve es porBloques.
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Torso', exercises: [
      ex('p1', 'Press banca'), ex('e1', 'Jalón al pecho'), ex('h1', 'Elevaciones laterales'),
      ex('p2', 'Aperturas en polea'), ex('e2', 'Remo con barra'),
    ] }];
    S.draft = null;
  });

  it('la rutina se ve y se ordena por bloques (porBloques)', () => {
    const ctx = A.contextoRutina(0);
    expect(ctx.movibles.map(x => x.id)).toEqual(['p1', 'p2', 'e1', 'e2', 'h1']);
    expect(ctx.fijos).toEqual([]);
  });

  it('sugiere después del último de su grupo, y lo explica', () => {
    const s = A.posicionSugerida(A.contextoRutina(0), 'Espalda');
    expect(s.pos).toBe(4);
    expect(s.texto).toBe('Sugerido: con los otros de espalda, después de Remo con barra.');
    expect(A.posicionSugerida(A.contextoRutina(0), 'Hombro').texto)
      .toBe('Sugerido: con el otro de hombro, después de Elevaciones laterales.');
  });

  it('sin otro de su grupo, al final', () => {
    expect(A.posicionSugerida(A.contextoRutina(0), 'Bíceps'))
      .toEqual({ pos: 5, texto: 'Sugerido: al final. Hoy no hay otro de bíceps.' });
  });

  it('turno vacío: es el primero', () => {
    S.routine[0].exercises = [];
    expect(A.posicionSugerida(A.contextoRutina(0), 'Pecho')).toEqual({ pos: 0, texto: 'Es el primero del turno.' });
  });

  it('con su grupo presente sólo vale dentro de su bloque', () => {
    expect(A.posicionesValidas(A.contextoRutina(0), 'Espalda')).toEqual([2, 3, 4]);
  });

  it('un grupo nuevo sólo entra entre bloques', () => {
    expect(A.posicionesValidas(A.contextoRutina(0), 'Bíceps')).toEqual([0, 2, 4, 5]);
  });

  it('▲▼ recorren las posiciones válidas y frenan en el borde', () => {
    const ctx = A.contextoRutina(0);
    let e = conNombre('rutina', 'Remo en polea');
    expect(A.posicionDe(e, ctx)).toBe(4);
    e = A.moverNuevo(e, ctx, -1); expect(A.posicionDe(e, ctx)).toBe(3);
    e = A.moverNuevo(e, ctx, -1); expect(A.posicionDe(e, ctx)).toBe(2);
    expect(A.moverNuevo(e, ctx, -1)).toBe(e);
    e = A.moverNuevo(A.moverNuevo(e, ctx, 1), ctx, 1);
    expect(A.posicionDe(e, ctx)).toBe(4);
    expect(A.moverNuevo(e, ctx, 1)).toBe(e);
  });

  it('soltar fuera de lo válido lo lleva al lugar válido más cercano', () => {
    const ctx = A.contextoRutina(0);
    const e = conNombre('rutina', 'Remo en polea');
    // soltado arriba de todo, entre los de pecho
    expect(A.posicionDe(A.soltarEn(e, ctx, [NUEVO, 'p1', 'p2', 'e1', 'e2', 'h1']), ctx)).toBe(2);
    // entre los dos de espalda (caja recortada): vale
    expect(A.posicionDe(A.soltarEn(e, ctx, ['p2', 'e1', NUEVO, 'e2']), ctx)).toBe(3);
    // una caja sin la fila nueva no cambia nada
    expect(A.soltarEn(e, ctx, ['p1', 'p2'])).toBe(e);
  });

  it('la lista del paso 2 trae al nuevo insertado, numerado e iluminable', () => {
    const l = A.listaPaso2(conNombre('rutina', 'Remo en polea'), A.contextoRutina(0));
    expect(A.NUEVO).toBe(NUEVO);
    expect(l.filas.map(x => x.id)).toEqual(['p1', 'p2', 'e1', 'e2', NUEVO, 'h1']);
    expect(l.filas[l.idxNuevo]).toMatchObject({ id: NUEVO, name: 'Remo en polea', n: 5, nuevo: true, fijo: false });
    expect(l.sugerida.pos).toBe(4);
    expect(l.enSugerida).toBe(true);
    expect(l.puedeSubir).toBe(true);
    expect(l.puedeBajar).toBe(false);
  });

  it('movido del sugerido, la lista lo sabe', () => {
    const ctx = A.contextoRutina(0);
    const l = A.listaPaso2(A.moverNuevo(conNombre('rutina', 'Remo en polea'), ctx, -1), ctx);
    expect(l.enSugerida).toBe(false);
    expect(l.puedeBajar).toBe(true);
  });

  it('recorte: nuevo ±3 y "+N" plegado cuando no entra', () => {
    const filas = Array.from({ length: 14 }, (_, i) => ({ id: String(i) }));
    expect(A.recortar(filas, 6)).toMatchObject({ desde: 3, hasta: 10, arriba: 3, abajo: 4 });
    expect(A.recortar(filas, 6).visibles.map(x => x.id)).toEqual(['3', '4', '5', '6', '7', '8', '9']);
    expect(A.recortar(filas, 0)).toMatchObject({ desde: 0, hasta: 7, arriba: 0, abajo: 7 });
    expect(A.recortar(filas, 13)).toMatchObject({ desde: 7, hasta: 14, arriba: 7, abajo: 0 });
    // plegar UNA sola fila no ahorra nada: con 8 se muestran todas
    expect(A.recortar(filas.slice(0, 8), 7)).toMatchObject({ desde: 0, hasta: 8, arriba: 0, abajo: 0 });
  });
});

describe('paso 2: dónde va (sesión)', () => {
  beforeEach(() => {
    S.routine = [{ id: 's1', order: 0, type: 'workout', name: 'Tirón', exercises: [
      ex('a', 'Jalón al pecho'), ex('b', 'Curl con barra'), ex('c', 'Remo con barra'), ex('d', 'Face pull'), ex('e', 'Curl martillo'),
    ] }];
    S.draft = {
      id: 'd1', date: '2026-09-27', slotId: 's1', dayName: 'Tirón', open: 1, start: 1, cur: 'c',
      order: ['a', 'b', 'c', 'd', 'e'], skipped: ['b'], extraSets: {}, extras: [],
      entries: { a: { sets: [{}, {}, {}] }, c: { sets: [{}] } },
    };
    S.hoyVals = {};
  });

  it('hechos, empezados y salteados van arriba y fijos; los pendientes se mueven', () => {
    const ctx = A.contextoSesion(0);
    expect(ctx.fijos.map(x => [x.id, x.estado])).toEqual([['a', 'hecho'], ['b', 'salteado'], ['c', 'en-curso']]);
    expect(ctx.movibles.map(x => x.id)).toEqual(['d', 'e']);
    // la sesión no reagrupa: vale cualquier lugar entre los pendientes
    expect(A.posicionesValidas(ctx, 'Espalda')).toEqual([0, 1, 2]);
  });

  it('si su grupo sólo está en lo ya hecho, va primero entre los pendientes', () => {
    expect(A.posicionSugerida(A.contextoSesion(0), 'Espalda'))
      .toEqual({ pos: 0, texto: 'Sugerido: el próximo, para seguir con espalda.' });
  });

  it('la lista arranca con los fijos y numera todo', () => {
    const l = A.listaPaso2(conNombre('sesion', 'Remo en polea'), A.contextoSesion(0));
    expect(l.filas.map(x => x.id)).toEqual(['a', 'b', 'c', NUEVO, 'd', 'e']);
    expect(l.filas.filter(x => x.fijo).map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect(l.filas.map(x => x.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(l.idxNuevo).toBe(3);
    expect(l.puedeSubir).toBe(false);
  });

  it('sin pendientes: va después de lo que ya hiciste', () => {
    S.draft.entries = { a: { sets: [{}, {}, {}] }, c: { sets: [{}] }, d: { sets: [{}] }, e: { sets: [{}] } };
    expect(A.posicionSugerida(A.contextoSesion(0), 'Hombro')).toEqual({ pos: 0, texto: 'Va después de lo que ya hiciste.' });
  });
});
