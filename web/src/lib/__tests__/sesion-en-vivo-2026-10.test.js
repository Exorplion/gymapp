// Los tres bugs de la sesión en vivo de Enzo del 2026-10-01 (Posterior):
// la serie extra de un unilateral que sumaba medio lado ("Serie 3 de 2"),
// el calentamiento que desaparecía al cerrar y reabrir la app, y la rueda
// que caminaba sola al tocar el número para escribirlo (este último en CSS,
// abajo).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { S } from '../state.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../rest.js', () => ({ startRest: vi.fn(), stopRest: vi.fn(), T: { rir: null }, pedirRir: vi.fn(), marcarRirElegido: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));

import {
  targetSets, seriesCompletas, addExtraSet, dropSet, startSession, startExercise,
  calentamientoPendiente, tildarCalentamiento, cerrarCalentamiento,
} from '../session.js';

const pajaros = { id: 'p', name: 'Pájaros', sets: 2, reps: 9, unilateral: true };
const remo = { id: 'r', name: 'Remo neutro', sets: 3, reps: 9 };

beforeEach(() => {
  S.routine = [{ id: 'post', order: 0, type: 'workout', name: 'Posterior', exercises: [pajaros, remo] }];
  S.draft = {
    id: 'd1', date: '2026-10-01', slotId: 'post', dayName: 'Posterior',
    open: 1, start: 1, cur: 'p', entries: {},
    order: ['p', 'r'], skipped: [], extraSets: {}, extras: [],
  };
});

describe('una serie más en un unilateral es una serie entera, no un lado', () => {
  it('2×9 unilateral + una serie más = 3 series (6 filas)', async () => {
    expect(targetSets(pajaros)).toBe(4);
    await addExtraSet('p');
    expect(targetSets(pajaros)).toBe(6);
    expect(seriesCompletas(targetSets(pajaros), true)).toBe(3);
  });

  it('con las 2 series hechas, la extra pide la serie 3 de 3 — nunca "3 de 2"', async () => {
    S.draft.entries.p = { name: 'Pájaros', unilateral: true, sets: [
      { w: 20, r: 7, side: 'left' }, { w: 20, r: 7, side: 'right' },
      { w: 20, r: 7, side: 'left' }, { w: 20, r: 7, side: 'right' },
    ] };
    await addExtraSet('p');
    const objetivo = seriesCompletas(targetSets(pajaros), true);
    const hechas = seriesCompletas(S.draft.entries.p.sets.length, true);
    expect(hechas + 1).toBeLessThanOrEqual(objetivo);
  });

  it('una serie menos saca los dos lados', async () => {
    expect(await dropSet('p')).toBe(2);
    expect(seriesCompletas(targetSets(pajaros), true)).toBe(1);
  });

  it('una serie menos nunca deja un unilateral con medio lado', async () => {
    await dropSet('p');
    expect(await dropSet('p')).toBe(2);   // el piso es una serie entera
  });

  it('una serie menos no borra un lado ya hecho', async () => {
    S.draft.entries.p = { name: 'Pájaros', unilateral: true, sets: [
      { w: 20, r: 7, side: 'left' }, { w: 20, r: 7, side: 'right' }, { w: 20, r: 7, side: 'left' },
    ] };
    // 1½ series hechas: bajar de 2 a 1 dejaría el lado izquierdo sin pareja.
    expect(await dropSet('p')).toBe(4);
  });

  it('en bilateral sigue siendo de a una', async () => {
    await addExtraSet('r');
    expect(targetSets(remo)).toBe(4);
  });
});

describe('el calentamiento sobrevive a cerrar la app', () => {
  beforeEach(() => { S.draft = null; });

  it('abrir la sesión lo deja pendiente', async () => {
    await startSession(0);
    expect(calentamientoPendiente()).toBe(true);
  });

  it('los tildes se guardan en el borrador', async () => {
    await startSession(0);
    await tildarCalentamiento(1);
    expect(S.draft.calent.hechos).toEqual([1]);
    await tildarCalentamiento(1);
    expect(S.draft.calent.hechos).toEqual([]);
  });

  it('"A entrenar" o "Saltar" lo cierran para siempre', async () => {
    await startSession(0);
    await cerrarCalentamiento();
    expect(calentamientoPendiente()).toBe(false);
  });

  it('empezar el primer ejercicio también lo da por hecho', async () => {
    await startSession(0);
    await startExercise(pajaros);
    expect(calentamientoPendiente()).toBe(false);
  });

  it('un borrador viejo, sin el campo, no lo vuelve a abrir', () => {
    S.draft = { id: 'x', slotId: 'post', start: null, entries: {} };
    expect(calentamientoPendiente()).toBe(false);
  });
});

describe('la rueda: CSS que la mantiene quieta', () => {
  const css = readFileSync(resolve(__dirname, '../../styles.css'), 'utf8');
  const regla = sel => {
    const i = css.indexOf(`${sel}{`);
    return i < 0 ? null : css.slice(i, css.indexOf('}', i));
  };

  it('el diente en edición no cambia de ancho', () => {
    const r = regla('.reel-tooth.on.editing');
    expect(r).not.toBeNull();
    expect(r).not.toMatch(/width\s*:\s*auto/);
    expect(css).not.toMatch(/\.reel-tooth\.on\.editing\s+input/);
  });

  it('el campo de edición flota sobre la rueda', () => {
    expect(regla('.reel-edit')).toMatch(/position:absolute/);
  });

  it('toda caja que se pliega por filas tiene la columna acotada', () => {
    // Una columna `auto` crece al ancho mínimo del contenido: la "Meta de hoy"
    // larga estiraba la parte en vivo fuera de la tarjeta.
    const reglas = css.match(/[^{}]+\{[^}]*grid-template-rows:\s*[01]fr[^}]*\}/g) || [];
    const base = reglas.filter(r => /display:\s*grid/.test(r));
    expect(base.length).toBeGreaterThanOrEqual(8);
    for (const r of base) expect(r, r.split('{')[0].trim()).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});
