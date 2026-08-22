import { S } from '../state.js';
import {
  targetSets, sessionExs, nextPending, isSkipped,
  skipExercise, unskipExercise, addExtraSet, addSessionExercise, replaceSessionExercise,
  dropSet, reemplazaA, isUnilateral, toggleUnilateral, saveSet, entryDelta, groupSets,
} from '../session.js';

jest.mock('../db.js', () => ({ idb: { put: jest.fn(), del: jest.fn(), all: jest.fn(), clear: jest.fn() } }));
jest.mock('../toast.js', () => ({ toast: jest.fn() }));
// rest.js/carousel.js NO se mockean (mismo criterio que session.test.js): son
// stubs no-op reales (Task 2) y ningún test de este archivo verifica llamadas
// ni argumentos sobre ellos (nadie assertea sobre startRest/stopRest/
// scrollCarouselTo), así que dejar que corran de verdad da el mismo resultado
// que un jest.fn() sin usar. `confetti.js` tampoco existe en esta etapa —
// session.js no lo importa (ver el comentario en completeSession() sobre por
// qué el confetti de PRs ya no se dispara ahí) — así que no hay nada que
// mockear.
//
// Nota de alcance: el stub `startRest()` (rest.js, Task 2) es no-op y no
// recibe el parámetro `segs` que tiene el real — ningún test de este archivo
// depende de eso (no hay asserts sobre segmentos de descanso), así que no es
// una limitación que este archivo de test exponga; queda documentada acá por
// si una etapa futura porta tests de rest.js que sí lo necesiten.

const ex = (id, name, sets = 3) => ({ id, name, sets, reps: 10 });

beforeEach(() => {
  S.routine = [{ id: 'slot4', order: 0, type: 'workout', name: 'Anterior A', exercises: [ex('a', 'Press'), ex('b', 'Remo'), ex('c', 'Curl')] }];
  S.draft = {
    id: 'd1', date: '2026-08-06', slotId: 'slot4', dayName: 'Anterior A',
    open: 1, start: null, cur: null, entries: {},
    order: ['a', 'b', 'c'], skipped: [], extraSets: {}, extras: [],
  };
});

describe('targetSets', () => {
  it('sin series extra es el objetivo de la rutina', () => {
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });

  it('suma las series concedidas para esta sesión', () => {
    S.draft.extraSets = { a: 2 };
    expect(targetSets(ex('a', 'Press', 3))).toBe(5);
  });

  it('sin borrador abierto no explota', () => {
    S.draft = null;
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });

  it('un borrador viejo sin el campo tampoco explota', () => {
    delete S.draft.extraSets;
    expect(targetSets(ex('a', 'Press', 3))).toBe(3);
  });
});

describe('sessionExs', () => {
  it('devuelve los de la rutina en el orden del borrador', () => {
    S.draft.order = ['c', 'a', 'b'];
    expect(sessionExs(0).map(e => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('incluye los ejercicios agregados sólo para hoy', () => {
    S.draft.extras = [ex('x', 'Face pull')];
    S.draft.order = ['a', 'b', 'c', 'x'];
    expect(sessionExs(0).map(e => e.name)).toEqual(['Press', 'Remo', 'Curl', 'Face pull']);
  });

  it('un borrador viejo sin extras sigue funcionando', () => {
    delete S.draft.extras;
    expect(sessionExs(0)).toHaveLength(3);
  });
});

describe('saltar', () => {
  it('marca y desmarca', async () => {
    await skipExercise('b');
    expect(isSkipped('b')).toBe(true);
    await unskipExercise('b');
    expect(isSkipped('b')).toBe(false);
  });

  it('no cambia el orden: restablecer lo devuelve a su lugar', async () => {
    await skipExercise('b');
    await unskipExercise('b');
    expect(S.draft.order).toEqual(['a', 'b', 'c']);
    expect(sessionExs(0).map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('nextPending lo ignora', async () => {
    await skipExercise('a');
    expect(nextPending(sessionExs(0)).id).toBe('b');
  });

  it('saltar el que está en curso lo suelta', async () => {
    S.draft.cur = 'a';
    await skipExercise('a');
    expect(S.draft.cur).toBe(null);
  });

  it('con todo salteado no queda ninguno pendiente', async () => {
    await skipExercise('a'); await skipExercise('b'); await skipExercise('c');
    expect(nextPending(sessionExs(0))).toBe(null);
  });

  it('saltar dos veces no lo duplica', async () => {
    await skipExercise('b'); await skipExercise('b');
    expect(S.draft.skipped).toEqual(['b']);
  });
});

describe('addExtraSet', () => {
  it('sube el techo de a uno', async () => {
    await addExtraSet('a');
    expect(targetSets(ex('a', 'Press', 3))).toBe(4);
    await addExtraSet('a');
    expect(targetSets(ex('a', 'Press', 3))).toBe(5);
  });

  it('reabre un ejercicio que estaba completo', async () => {
    S.draft.entries.a = { name: 'Press', sets: [{ w: 50, r: 10 }, { w: 50, r: 10 }, { w: 50, r: 10 }] };
    expect(nextPending(sessionExs(0)).id).toBe('b');
    await addExtraSet('a');
    expect(nextPending(sessionExs(0)).id).toBe('a');
  });
});

describe('addSessionExercise', () => {
  it('lo agrega al final y al orden, sin tocar la rutina', async () => {
    await addSessionExercise({ name: 'Face pull', sets: 3, reps: 12 });
    expect(S.draft.extras).toHaveLength(1);
    expect(S.draft.order[S.draft.order.length - 1]).toBe(S.draft.extras[0].id);
    expect(S.routine[0].exercises).toHaveLength(3);   // la rutina no se toca
  });

  it('el agregado aparece en sessionExs', async () => {
    await addSessionExercise({ name: 'Face pull', sets: 3, reps: 12 });
    expect(sessionExs(0).map(e => e.name)).toContain('Face pull');
  });
});

describe('replaceSessionExercise', () => {
  /* Antes el original quedaba marcado como saltado y seguía ocupando su
     tarjeta: pedías cambiar y te quedaban los dos. Ahora sale de la lista. */
  it('saca el viejo y pone el nuevo en su lugar exacto', async () => {
    await replaceSessionExercise('b', { name: 'Remo polea', sets: 3, reps: 10 });
    expect(isSkipped('b')).toBe(false);
    expect(sessionExs(0).map(e => e.name)).toEqual(['Press', 'Remo polea', 'Curl']);
  });

  it('el reemplazo queda justo donde estaba el original en el orden', async () => {
    await replaceSessionExercise('a', { name: 'Press máquina', sets: 3, reps: 10 });
    const nuevo = S.draft.extras[0];
    expect(S.draft.order.indexOf(nuevo.id)).toBe(1);   // pegado detrás de 'a'
    expect(S.draft.order[0]).toBe('a');
  });

  /* El cambio de variante en vivo (SessionExercise.jsx) manda el MISMO nombre
     con otro equipo — "predicador con barra" a "predicador con mancuerna" —
     y esto es lo que hace que ese cambio se registre como una variante nueva
     y no como si nada hubiera pasado. */
  it('lleva el equipo y la máquina nuevos, con el nombre sin tocar', async () => {
    await replaceSessionExercise('a', { name: 'Press', sets: 3, reps: 10, equip: 'polea', machine: 'se siente pesada' });
    const nuevo = S.draft.extras[0];
    expect(nuevo).toMatchObject({ name: 'Press', equip: 'polea', machine: 'se siente pesada' });
  });

  it('lleva el flag unilateral', async () => {
    await replaceSessionExercise('a', { name: 'Press', sets: 3, reps: 10, unilateral: true });
    expect(S.draft.extras[0].unilateral).toBe(true);
  });
});

describe('isUnilateral / toggleUnilateral', () => {
  it('sin override, es lo que dice la rutina', () => {
    expect(isUnilateral({ id: 'a', unilateral: true })).toBe(true);
    expect(isUnilateral({ id: 'b' })).toBe(false);
  });

  it('togglear crea un override de sesión que pisa a la rutina', async () => {
    await toggleUnilateral('a');   // 'a' (Press) no es unilateral en la rutina
    expect(isUnilateral(S.routine[0].exercises.find(e => e.id === 'a'))).toBe(true);
  });

  it('togglear dos veces vuelve al valor de la rutina', async () => {
    await toggleUnilateral('a');
    await toggleUnilateral('a');
    expect(isUnilateral(S.routine[0].exercises.find(e => e.id === 'a'))).toBe(false);
  });

  it('sin sesión abierta no explota', async () => {
    S.draft = null;
    await expect(toggleUnilateral('a')).resolves.toBeUndefined();
  });

  it('si ya hay una serie registrada hoy, el toggle también actualiza esa entrada', async () => {
    S.hoyVals = {};
    await saveSet('a');   // crea S.draft.entries.a con unilateral: false (heredado)
    expect(S.draft.entries.a.unilateral).toBe(false);
    await toggleUnilateral('a');
    expect(S.draft.entries.a.unilateral).toBe(true);
  });
});

describe('entryDelta', () => {
  beforeEach(() => { S.sessions = []; });

  it('compara la mejor serie contra la sesión anterior del mismo ejercicio', async () => {
    const vieja = { id: 'v', date: '2026-08-01', start: 100, entries: [{ name: 'Jalón', sets: [{ w: 80, r: 7 }] }] };
    const nueva = { id: 'n', date: '2026-08-06', start: 200, entries: [{ name: 'Jalón', sets: [{ w: 85, r: 7 }] }] };
    S.sessions = [nueva, vieja];
    expect(entryDelta(nueva, nueva.entries[0])).toEqual({ delta: 5, anterior: 80, actual: 85 });
  });

  it('sin sesión anterior no inventa comparación', async () => {
    const sola = { id: 'n', date: '2026-08-06', start: 200, entries: [{ name: 'Jalón', sets: [{ w: 85, r: 7 }] }] };
    S.sessions = [sola];
    expect(entryDelta(sola, sola.entries[0])).toBe(null);
  });

  it('el equipo distinto no es la misma serie histórica', async () => {
    const vieja = { id: 'v', date: '2026-08-01', start: 100, entries: [{ name: 'Press', equip: 'barra', sets: [{ w: 80, r: 7 }] }] };
    const nueva = { id: 'n', date: '2026-08-06', start: 200, entries: [{ name: 'Press', equip: 'discos', sets: [{ w: 85, r: 7 }] }] };
    S.sessions = [nueva, vieja];
    expect(entryDelta(nueva, nueva.entries[0])).toBe(null);
  });

  it('bajar también se informa', async () => {
    const vieja = { id: 'v', date: '2026-08-01', start: 100, entries: [{ name: 'Jalón', sets: [{ w: 90, r: 7 }] }] };
    const nueva = { id: 'n', date: '2026-08-06', start: 200, entries: [{ name: 'Jalón', sets: [{ w: 85, r: 7 }] }] };
    S.sessions = [nueva, vieja];
    expect(entryDelta(nueva, nueva.entries[0]).delta).toBe(-5);
  });
});

describe('groupSets', () => {
  it('agrupa series consecutivas del mismo peso: "85 por 7 y 6"', async () => {
    expect(groupSets([{ w: 85, r: 7 }, { w: 85, r: 6 }])).toEqual([{ w: 85, reps: [7, 6], from: 1 }]);
  });

  it('un cambio de peso abre un grupo nuevo', async () => {
    expect(groupSets([{ w: 60, r: 10 }, { w: 65, r: 8 }, { w: 65, r: 7 }]))
      .toEqual([{ w: 60, reps: [10], from: 1 }, { w: 65, reps: [8, 7], from: 2 }]);
  });

  it('volver al mismo peso más tarde no se fusiona con el grupo anterior', async () => {
    expect(groupSets([{ w: 60, r: 10 }, { w: 65, r: 8 }, { w: 60, r: 9 }]))
      .toEqual([{ w: 60, reps: [10], from: 1 }, { w: 65, reps: [8], from: 2 }, { w: 60, reps: [9], from: 3 }]);
  });

  it('la numeración de series es continua entre grupos', async () => {
    const g = groupSets([{ w: 60, r: 10 }, { w: 60, r: 9 }, { w: 65, r: 8 }]);
    // serie 1 y 2 al primer peso, serie 3 al segundo
    expect(g.map(x => x.from)).toEqual([1, 3]);
  });

  it('sin series devuelve lista vacía', async () => {
    expect(groupSets([])).toEqual([]);
    expect(groupSets(undefined)).toEqual([]);
  });
});

describe('cambiar un ejercicio por otro', () => {
  it('el original desaparece de la lista', async () => {
    await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    const nombres = sessionExs(0).map(e => e.name);
    expect(nombres).not.toContain('Remo');
    expect(nombres).toContain('Jalón');
  });

  it('el reemplazo entra en el lugar del original, no al final', async () => {
    await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    expect(sessionExs(0).map(e => e.name)).toEqual(['Press', 'Jalón', 'Curl']);
  });

  // "Que se quede registrado por cuál lo cambié": el original ya no está a la
  // vista, pero no se perdió.
  it('queda anotado a cuál reemplazó', async () => {
    const nuevo = await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    expect(reemplazaA(nuevo.id)).toBe('Remo');
  });

  it('los que no reemplazaron a nadie no dicen nada', async () => {
    await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    expect(reemplazaA('a')).toBe(null);
  });

  it('el reemplazo queda como ejercicio actual', async () => {
    const nuevo = await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    expect(S.draft.cur).toBe(nuevo.id);
  });

  // El original sale de la lista por `replaced`, no por `skipped`: si contara
  // como saltado, el resumen del día diría que salteaste algo que en realidad
  // cambiaste.
  it('cambiar no es lo mismo que saltar', async () => {
    await replaceSessionExercise('b', { name: 'Jalón', sets: 3, reps: 10 });
    expect(isSkipped('b')).toBe(false);
  });
});

describe('dropSet', () => {
  it('baja el objetivo en uno', async () => {
    expect(await dropSet('a')).toBe(2);
    expect(targetSets(ex('a', 'Press', 3))).toBe(2);
  });

  it('deshace una serie extra antes de tocar el plan', async () => {
    S.draft.extraSets = { a: 1 };
    expect(await dropSet('a')).toBe(3);
  });

  // "Solo borro la que no hice": nunca toca una serie registrada.
  it('no baja por debajo de las series que ya hiciste', async () => {
    S.draft.entries = { a: { name: 'Press', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }] } };
    expect(await dropSet('a')).toBe(2);
    expect(await dropSet('a')).toBe(2);
    expect(S.draft.entries.a.sets).toHaveLength(2);
  });

  it('nunca deja un ejercicio en cero series', async () => {
    await dropSet('a'); await dropSet('a');
    expect(await dropSet('a')).toBe(1);
    expect(targetSets(ex('a', 'Press', 3))).toBe(1);
  });

  it('si al bajar queda completo, pasa al siguiente', async () => {
    S.draft.cur = 'a';
    S.draft.entries = { a: { name: 'Press', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }] } };
    await dropSet('a');
    expect(S.draft.cur).toBe('b');
  });

  it('sin sesión abierta no explota', async () => {
    S.draft = null;
    expect(await dropSet('a')).toBe(0);
  });
});
