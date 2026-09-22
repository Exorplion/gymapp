// La pregunta del RIR después de confirmar la serie (pedido de Enzo,
// 2026-09-21): antes se pedía ANTES de confirmar, escondida en el <details>
// "Más opciones", y no la contestaba nadie. Ahora saveSet() registra la serie,
// arranca el descanso y recién ahí pregunta — y la respuesta parchea el `rpe`
// de la serie que ya está guardada.
//
// rest.js se mockea con un fake chiquito en vez de stubs sueltos: lo que hay
// que testear es qué serie queda apuntada y sobre cuál se escribe, o sea el
// contenido de T.rir, no que "se llamó a una función".
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S } from '../state.js';
import { saveSet, ensureVals, setRirUltimaSerie, toggleUnilateral, seriesCompletas } from '../session.js';
import { rirScheme } from '../exdb.js';
import { RIR_OPTS, rirPedido } from '../rir.js';
import { T, startRest, pedirRir } from '../rest.js';

vi.mock('../db.js', () => ({ idb: { put: vi.fn(), del: vi.fn(), all: vi.fn(), clear: vi.fn() } }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../confetti.js', () => ({ fireConfetti: vi.fn() }));
vi.mock('../alarm.js', () => ({ pedirPermiso: vi.fn() }));
vi.mock('../rest.js', () => {
  const T = { rir: null };
  return {
    T,
    // el fake respeta lo único que importa del contrato real: cada descanso
    // arranca SIN pregunta, y sólo pedirRir() la pone
    startRest: vi.fn(() => { T.rir = null; }),
    stopRest: vi.fn(),
    pedirRir: vi.fn(({ exId, setIdx, pedia }) => { T.rir = { exId, setIdx, pedia: pedia ?? null, valor: null }; }),
    marcarRirElegido: vi.fn(v => { if (T.rir) T.rir.valor = v; }),
  };
});

const ex = (id, name, sets = 3, unilateral = false) => ({ id, name, sets, reps: 12, unilateral });

function armar(exs) {
  S.cfg = { unit: 'kg', rest: 90, restSide: 20 };
  S.sessions = [];
  S.routine = [{ id: 'd1', name: 'Día 1', dow: new Date().getDay(), exercises: exs }];
  S.draft = null;
  T.rir = null;
  vi.clearAllMocks();
}

/** Registra una serie completa con peso y reps válidos. */
async function serie(e, w = 40, r = 10) {
  const v = ensureVals(e);
  v.w = w; v.r = r;
  await saveSet(e.id);
}

const setsDe = id => S.draft.entries[id].sets;

describe('RIR después de confirmar la serie', () => {
  beforeEach(() => armar([ex('a', 'Press banca')]));

  it('pregunta recién después de guardar, apuntando a la serie que se acaba de registrar', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    expect(startRest).toHaveBeenCalled();
    expect(pedirRir).toHaveBeenCalledTimes(1);
    expect(T.rir).toMatchObject({ exId: 'a', setIdx: 0 });
    // la serie ya está guardada, y sin contestar queda en null
    expect(setsDe('a')).toHaveLength(1);
    expect(setsDe('a')[0].rpe).toBe(null);
  });

  it('escribe el rpe sobre ESA serie y no sobre otra', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    await setRirUltimaSerie(2);   // serie 1
    await serie(e);
    await setRirUltimaSerie(0);   // serie 2, al fallo
    const sets = setsDe('a');
    expect(sets.map(s => s.rpe)).toEqual([8, 10]); // rpe = 10 - rir
  });

  it('"4+" se guarda como rpe 6, el techo exacto de ese balde', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    await setRirUltimaSerie(4);
    expect(setsDe('a')[0].rpe).toBe(6);
  });

  it('no contestar deja el rpe en null y no rompe la serie siguiente', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    await serie(e);
    expect(setsDe('a').map(s => s.rpe)).toEqual([null, null]);
  });

  it('se puede corregir tocando otro chip y des-seleccionar tocando el mismo', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    await setRirUltimaSerie(3);
    expect(setsDe('a')[0].rpe).toBe(7);
    await setRirUltimaSerie(1);   // me equivoqué, fue 1
    expect(setsDe('a')[0].rpe).toBe(9);
    await setRirUltimaSerie(null); // mejor no digo nada
    expect(setsDe('a')[0].rpe).toBe(null);
    expect(T.rir.valor).toBe(null);
  });

  it('sin pregunta en curso no escribe nada (descanso de calentamiento, draft descartado)', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    // el calentamiento llama startRest(segs) por su cuenta: eso limpia la
    // pregunta, porque no hay ninguna serie a la que atarle el RIR
    startRest(165);
    expect(T.rir).toBe(null);
    expect(await setRirUltimaSerie(2)).toBe(false);
    expect(setsDe('a')[0].rpe).toBe(null);
  });

  it('si el draft se fue, contestar no explota', async () => {
    const e = S.routine[0].exercises[0];
    await serie(e);
    S.draft = null;
    expect(await setRirUltimaSerie(2)).toBe(false);
  });
});

describe('RIR en unilateral', () => {
  beforeEach(() => armar([ex('u', 'Curl martillo', 4, true)]));

  it('no pregunta en la fila impar (todavía falta el otro lado) y sí cuando la serie cerró', async () => {
    const e = S.routine[0].exercises[0];
    toggleUnilateral('u');
    await serie(e); // fila 1: lado uno, descanso corto de 20s
    expect(startRest).toHaveBeenCalledWith(20);
    expect(pedirRir).not.toHaveBeenCalled();
    expect(T.rir).toBe(null);

    await serie(e); // fila 2: la serie cerró
    expect(pedirRir).toHaveBeenCalledTimes(1);
    expect(T.rir).toMatchObject({ exId: 'u', setIdx: 1 });

    // y el rpe cae en la fila 2, la que acaba de cerrar la serie
    await setRirUltimaSerie(2);
    expect(setsDe('u').map(s => s.rpe)).toEqual([null, 8]);
  });
});

/* Bug reportado por Enzo (2026-09-22): en unilateral la pregunta del descanso
   decía "pedía RIR 6", un valor que no existe entre los chips (0/1/2/3/4+).
   Causa: el esquema se armaba sobre targetSets(), que cuenta FILAS — un 4×10
   unilateral son 8 filas, y rirScheme(8) = 7/6/5/4/3/2/1/0. El esquema tiene
   que ir sobre SERIES REALES. */
describe('el esquema de RIR va sobre series reales, no sobre filas', () => {
  it('un unilateral de 4 series pide 3/2/1/0, no los escalones de 8 filas', async () => {
    armar([ex('u', 'Curl martillo', 4, true)]);
    const e = S.routine[0].exercises[0];
    toggleUnilateral('u');
    const pedidos = [];
    for (let fila = 0; fila < 8; fila++) {
      await serie(e);
      if (T.rir) pedidos.push(T.rir.pedia);
    }
    expect(pedidos).toEqual([3, 2, 1, 0]);
  });

  it('nunca prescribe un valor fuera de la escala que la app ofrece', async () => {
    armar([ex('u', 'Curl martillo', 4, true)]);
    const e = S.routine[0].exercises[0];
    toggleUnilateral('u');
    for (let fila = 0; fila < 8; fila++) {
      await serie(e);
      if (T.rir) expect(RIR_OPTS).toContain(T.rir.pedia);
    }
  });

  it('bilateral: sin regresión, sigue dando el mismo esquema de siempre', async () => {
    armar([ex('b', 'Press banca', 4)]);
    const e = S.routine[0].exercises[0];
    const pedidos = [];
    for (let fila = 0; fila < 4; fila++) {
      await serie(e);
      pedidos.push(T.rir.pedia);
    }
    expect(pedidos).toEqual(rirScheme(4, 'Press banca'));
  });
});

/* La tarjeta del ejercicio (ExerciseCarousel.jsx) calcula el MISMO número con
   la misma receta: esquema sobre seriesCompletas(objetivo) e índice sobre
   seriesCompletas(filasHechas). Se replica acá como función pura para fijar
   el contrato — si alguien toca una de las dos cuentas, este test avisa. */
const rirDeTarjeta = (filasHechas, filasObjetivo, uni, name) =>
  rirPedido(rirScheme(seriesCompletas(filasObjetivo, uni), name), seriesCompletas(filasHechas, uni));

describe('la tarjeta y la pregunta del descanso piden lo mismo', () => {
  it('las dos filas de una misma serie unilateral piden el mismo RIR', () => {
    // 4 series reales = 8 filas. Filas 0 y 1 son la serie 1, 2 y 3 la serie 2…
    const porFila = Array.from({ length: 8 }, (_, f) => rirDeTarjeta(f, 8, true, 'Curl martillo'));
    expect(porFila).toEqual([3, 3, 2, 2, 1, 1, 0, 0]);
  });

  it('bilateral: la tarjeta sigue mostrando el escalón de siempre', () => {
    const porFila = Array.from({ length: 4 }, (_, f) => rirDeTarjeta(f, 4, false, 'Press banca'));
    expect(porFila).toEqual([3, 2, 1, 0]);
  });

  it('una serie extra concedida a mano no deja la tarjeta sin número', () => {
    // el índice se pasa del último escalón: corresponde el último (al fallo)
    expect(rirDeTarjeta(9, 8, true, 'Curl martillo')).toBe(0);
  });
});

describe('rirPedido', () => {
  it('acota al techo de la escala: un RIR 5 se ofrece como 4+', () => {
    expect(rirPedido([5, 4, 3, 2, 1, 0], 0)).toBe(4);
  });

  it('sin esquema no inventa un número', () => {
    expect(rirPedido([], 0)).toBe(null);
    expect(rirPedido(null, 0)).toBe(null);
  });
});
