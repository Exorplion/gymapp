import { describe, it, expect, afterEach, vi } from 'vitest';
import { S } from '../state.js';
import { catOf, daysSinceAll, daysSinceGroup, MUSCLE_CATS } from '../muscle.js';

/* G4 (auditoría total 2026-09): catOf() tenía caché, pero la miraba DESPUÉS
   de normalizar el nombre, y normalizar (normalize('NFD') + regex) era lo
   caro. daysSinceAll() la llama una vez por entrada de cada sesión por cada
   grupo: al cambiar de pestaña, norm() sumaba ~100 ms de tiempo propio a 6×.
   Un nombre ya visto se responde sin normalizar nada. */
describe('catOf: un nombre ya visto no se vuelve a normalizar', () => {
  afterEach(() => vi.restoreAllMocks());

  it('la segunda consulta del mismo nombre no llama a normalize()', () => {
    const nombre = 'Remo con barra T (prueba caché)';
    const primera = catOf(nombre);
    const spy = vi.spyOn(String.prototype, 'normalize');
    expect(catOf(nombre)).toBe(primera);
    expect(catOf({ name: nombre, sets: [] })).toBe(primera);
    expect(spy).not.toHaveBeenCalled();
  });

  it('nombres que difieren en tildes o mayúsculas siguen dando lo mismo', () => {
    expect(catOf('PRESS MILITAR máquina')).toBe(catOf('press militar maquina'));
  });

  it('el cat guardado en la entrada sigue mandando', () => {
    expect(catOf({ name: 'Press plano máquina', cat: 'Espalda' })).toBe('Espalda');
  });

  it('un nombre vacío no queda recordado como otra cosa', () => {
    expect(catOf('')).toBe(null);
    expect(catOf('   ')).toBe(null);
    expect(catOf(null)).toBe(null);
  });
});

describe('daysSinceAll: una sola pasada, mismo resultado que grupo por grupo', () => {
  afterEach(() => { S.sessions = []; vi.useRealTimers(); });

  it('coincide con daysSinceGroup para los nueve grupos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 10, 0, 0));
    const serie = [{ w: 50, r: 8 }];
    const ses = (id, date, exs) => ({ id, date, entries: exs.map(([name, sets]) => ({ name, sets })) });
    S.sessions = [
      ses('a', '2026-08-01', [['Jalón ancho', serie], ['Curl martillo', serie]]),
      ses('b', '2026-08-07', [['Press plano máquina', serie], ['Leg press', []]]),
      ses('c', '2026-08-09', [['Jalón ancho', serie], ['Elevaciones laterales', serie]]),
      ses('d', '2026-07-20', [['Leg press', serie], ['Hip thrust', serie]]),
    ];
    const todo = daysSinceAll();
    for (const c of MUSCLE_CATS) expect(todo[c]).toBe(daysSinceGroup(c));
    expect(Object.keys(todo).sort()).toEqual([...MUSCLE_CATS].sort());
  });
});
