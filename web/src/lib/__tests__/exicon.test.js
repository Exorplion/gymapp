import { describe, it, expect } from 'vitest';
import { iconOf } from '../exicon.js';
import { EXCATALOG } from '../muscle.js';

describe('iconOf', () => {
  it.each([
    ['Press banca', 'banca'],
    ['Press plano máquina', 'banca'],
    ['Press inclinado mancuernas', 'inclinado'],
    ['Sentadilla', 'sentadilla'],
    ['Leg press', 'prensa'],
    ['Dominadas', 'dominadas'],
    ['Jalón ancho', 'jalon'],
    ['Remo en polea', 'remopolea'],
    ['Remo con barra', 'remo'],
    ['Peso muerto', 'pesomuerto'],
    ['Hip thrust', 'hipthrust'],
    ['Standing calf raise', 'gemelos'],
    ['Rueda abdominal', 'rueda'],
  ])('%s → %s', (nombre, esperado) => expect(iconOf(nombre)).toBe(esperado));

  // El orden de la tabla es la lógica, igual que en catOf: sin él "curl" se
  // lleva puesto al femoral y "press" a medio catálogo.
  it('lo específico gana a lo genérico', () => {
    expect(iconOf('Curl femoral')).toBe('legcurl');
    expect(iconOf('Curl con barra')).toBe('curl');
    expect(iconOf('Press militar')).toBe('militar');
    expect(iconOf('JM press')).toBe('pushdown');
    expect(iconOf('Extensiones de cuádriceps')).toBe('legext');
    expect(iconOf('Extensión tríceps polea')).toBe('pushdown');
    expect(iconOf('Peso muerto rumano')).toBe('pesomuerto');
    expect(iconOf('Remo en polea')).toBe('remopolea');
  });

  it('acepta el objeto y no sólo el nombre', () => {
    expect(iconOf({ name: 'Sentadilla', sets: 3 })).toBe('sentadilla');
  });

  it('lo desconocido cae en el genérico, nunca en null', () => {
    expect(iconOf('Zarandaja voladora')).toBe('generico');
    expect(iconOf('')).toBe('generico');
    expect(iconOf(null)).toBe('generico');
    expect(iconOf(undefined)).toBe('generico');
  });

  // Si un ejercicio del catálogo cayera en el genérico sería un agujero
  // visible: una tarjeta con una mancuerna suelta entre otras que sí dicen
  // qué movimiento son.
  it('ningún ejercicio del catálogo queda sin pictograma propio', () => {
    const huerfanos = EXCATALOG.filter(e => iconOf(e.n) === 'generico').map(e => e.n);
    expect(huerfanos).toEqual([]);
  });
});
