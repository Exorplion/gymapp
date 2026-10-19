// kg/lb por máquina y peso traído de otro gym (Enzo, 2026-10-18).
//
// Lo que se protege: la primera vez en una máquina nueva la rueda arranca en
// lo que hiciste en la otra, en la unidad de allá ("si allá era kg, acá
// arranca en kg"), y nunca se inventa un número — sin historial en otro lado,
// no hay peso traído.
import { describe, it, expect, beforeEach } from 'vitest';
import { S, wToUnit, wFromUnit } from '../state.js';
import { pesoTraido, unidadDe, alEscalon, claveUnidad, pesoExacto, enLaMaquina, unidadUltima, corregirSeriesLb } from '../unidades.js';
import { objetivoHoy } from '../objetivoHoy.js';
import { warmupSets } from '../warmup.js';
import { reelValues } from '../reel.js';
import { wStep, wDisplay } from '../state.js';

const maq = (id, nombre) => ({ id, nombre });
const ses = (date, entries) => ({ id: date, date, start: new Date(date + 'T10:00:00').getTime(), entries });
const set = (w, r) => ({ w, r, t: 0 });

// La máquina de SmartFit y la del gym nuevo: mismo ejercicio, dos historiales.
const enSmart = { id: 'r1', name: 'Jalón al pecho', variante: 'm-smart' };
const enNuevo = { id: 'r1', name: 'Jalón al pecho', variante: 'm-nuevo' };

beforeEach(() => {
  S.gyms = [
    { id: 'a', name: 'SmartFit', equip: {}, maquinas: { 'jalón al pecho': [maq('m-smart', 'Polea')] } },
    { id: 'b', name: 'Gym Libras', equip: {}, maquinas: { 'jalón al pecho': [maq('m-nuevo', 'Polea alta')] } },
  ];
  S.cfg = { ...S.cfg, unit: 'kg', activeGym: 'b', unidades: {} };
  S.sessions = [];
});

describe('pesoTraido', () => {
  it('sin historial en ningún lado: null, no un número inventado', () => {
    expect(pesoTraido(enNuevo)).toBeNull();
  });

  it('trae lo de la otra máquina y dice de qué gym viene', () => {
    S.sessions = [ses('2026-10-14', [{ ...enSmart, sets: [set(47.5, 10), set(50, 10), set(50, 8)] }])];
    const t = pesoTraido(enNuevo);
    expect(t).toMatchObject({ kg: 50, r: 10, origen: 'SmartFit', enOtroGym: true });
  });

  it('con historial propio en esta máquina ya no trae nada (manda la progresión)', () => {
    S.sessions = [
      ses('2026-10-17', [{ ...enNuevo, sets: [set(45, 10)] }]),
      ses('2026-10-14', [{ ...enSmart, sets: [set(50, 10)] }]),
    ];
    expect(pesoTraido(enNuevo)).toBeNull();
  });

  it('gana la vez más reciente (las sesiones vienen de la más nueva a la más vieja)', () => {
    S.sessions = [
      ses('2026-10-14', [{ ...enSmart, sets: [set(52.5, 10)] }]),
      ses('2026-09-01', [{ ...enSmart, sets: [set(40, 10)] }]),
    ];
    expect(pesoTraido(enNuevo).kg).toBe(52.5);
  });

  it('un peso por lado no sirve de partida para uno con las dos manos', () => {
    S.sessions = [ses('2026-10-14', [{ ...enSmart, unilateral: true, sets: [set(20, 10)] }])];
    expect(pesoTraido(enNuevo)).toBeNull();
  });

  it('otra máquina del MISMO gym: dice la máquina, no el gym', () => {
    S.cfg.activeGym = 'a';
    const otra = { id: 'r1', name: 'Jalón al pecho', variante: 'm-otra' };
    S.sessions = [ses('2026-10-14', [{ ...enSmart, varianteNombre: 'Polea', sets: [set(50, 10)] }])];
    expect(pesoTraido(otra)).toMatchObject({ origen: 'Polea', enOtroGym: false });
  });
});

describe('unidadDe', () => {
  it('si allá era kg, acá arranca en kg aunque el gym venga usando lb', () => {
    S.gyms[1].unit = 'lb';
    S.sessions = [ses('2026-10-14', [{ ...enSmart, unit: 'kg', sets: [set(50, 10)] }])];
    expect(unidadDe(enNuevo)).toBe('kg');
  });

  it('si allá era lb, acá arranca en lb', () => {
    S.sessions = [ses('2026-10-14', [{ ...enSmart, unit: 'lb', sets: [set(50, 10)] }])];
    expect(unidadDe(enNuevo)).toBe('lb');
  });

  it('la que elegiste para esta máquina gana a todo', () => {
    S.sessions = [ses('2026-10-14', [{ ...enSmart, unit: 'kg', sets: [set(50, 10)] }])];
    S.cfg.unidades[claveUnidad('b', enNuevo)] = 'lb';
    expect(unidadDe(enNuevo)).toBe('lb');
  });

  it('con historial propio, la de la última vez en esta máquina', () => {
    S.sessions = [ses('2026-10-17', [{ ...enNuevo, unit: 'lb', sets: [set(50, 10)] }])];
    expect(unidadDe(enNuevo)).toBe('lb');
  });

  it('sin nada que la diga: la última del gym, y si no, la general', () => {
    expect(unidadDe(enNuevo)).toBe('kg');
    S.gyms[1].unit = 'lb';
    expect(unidadDe(enNuevo)).toBe('lb');
  });

  it('la elección es por gym: la misma máquina en otro gym no la hereda', () => {
    S.cfg.unidades[claveUnidad('a', enNuevo)] = 'lb';
    expect(unidadDe(enNuevo)).toBe('kg');
  });
});

describe('alEscalon', () => {
  it('50 kg en lb queda en 110 lb justas, no 110.2', () => {
    expect(wToUnit(alEscalon(50, 'lb'), 'lb')).toBeCloseTo(110, 6);
  });
  it('110 lb en kg queda en 50 kg (escalón de 2.5)', () => {
    expect(alEscalon(wFromUnit(110, 'lb'), 'kg')).toBe(50);
  });
});

describe('objetivoHoy con peso traído', () => {
  it('es "traido" con el peso de allá, y le gana al sugerido por 1RM', () => {
    S.sessions = [ses('2026-10-14', [{ ...enSmart, sets: [set(50, 10)] }])];
    const o = objetivoHoy(enNuevo);
    expect(o).toMatchObject({ tipo: 'traido', peso: 50, origen: 'SmartFit' });
  });
});

// La captura de Enzo (2026-10-19): en una máquina de lb la rueda decía 115.1 y
// "Sesión anterior" 110.2. Eran 52.2 kg (115 lb guardadas con redondeo a 0.1
// kg) y 50 kg hechos en otro gym, convertidos sin llevarlos a la máquina.
describe('números exactos en lb', () => {
  it('115 lb se guardan y vuelven como 115, no 115.1', () => {
    expect(wDisplay(pesoExacto(wFromUnit(115, 'lb'), 'lb'), 'lb')).toBe('115');
    // el redondeo viejo, en kg, es justo lo que las rompía
    expect(wDisplay(Math.round(wFromUnit(115, 'lb') * 10) / 10, 'lb')).toBe('115.1');
  });
  it('en kg el redondeo queda como siempre', () => {
    expect(pesoExacto(52.26, 'kg')).toBe(52.3);
  });

  it('un peso que viene de kg arranca en el escalón de la máquina de lb', () => {
    expect(wToUnit(enLaMaquina(50, 'lb'), 'lb')).toBeCloseTo(110, 6);
    expect(wToUnit(enLaMaquina(52.2, 'lb'), 'lb')).toBeCloseTo(115, 6);
  });
  it('uno que ya es un número de lb (112 a mano) no se toca', () => {
    const w = wFromUnit(112, 'lb');
    expect(enLaMaquina(w, 'lb')).toBe(w);
    expect(enLaMaquina(47.5, 'kg')).toBe(47.5);
  });

  it('la meta de hoy en lb, sobre una última vez en kg: 110 lb, no 110.2', () => {
    const shrug = { id: 'r2', name: 'Kelso shrug', reps: 9, sets: 3, variante: 'm-nuevo' };
    S.sessions = [ses('2026-10-14', [{ ...shrug, unit: 'kg', sets: [set(50, 9), set(50, 9), set(50, 9)] }])];
    S.cfg.unidades[claveUnidad('b', shrug)] = 'lb';
    expect(wDisplay(objetivoHoy(shrug).peso, 'lb')).toBe('110');
    // y "Sesión anterior" se dice como se hizo
    expect(unidadUltima(shrug)).toBe('kg');
  });
});

describe('corregirSeriesLb', () => {
  it('lleva las series en lb guardadas como 52.2 kg a 115 lb', () => {
    const e = { unit: 'lb', sets: [set(52.2, 11), set(49.9, 10)] };
    expect(corregirSeriesLb([e])).toBe(2);
    expect(wToUnit(e.sets[0].w, 'lb')).toBeCloseTo(115, 6);
    expect(wToUnit(e.sets[1].w, 'lb')).toBeCloseTo(110, 6);
  });
  it('no toca entradas en kg ni escalones de kg (series hechas antes de cambiar a lb)', () => {
    const enKg = { unit: 'kg', sets: [set(52.2, 10)] };
    const mixta = { unit: 'lb', sets: [set(20, 10), set(50, 10)] };
    expect(corregirSeriesLb([enKg, mixta])).toBe(0);
    expect(enKg.sets[0].w).toBe(52.2);
    expect(mixta.sets.map(s => s.w)).toEqual([20, 50]);
  });
  it('ya corregidas no cambian: se puede correr en cada arranque', () => {
    const e = { unit: 'lb', sets: [set(52.2, 11)] };
    corregirSeriesLb([e]);
    expect(corregirSeriesLb([e])).toBe(0);
  });
});

describe('la rueda y la rampa en lb dan números redondos', () => {
  it('la rampa de 175 lb son múltiplos de 5 lb, no 89.9', () => {
    const top = wFromUnit(175, 'lb');
    for (const s of warmupSets(top, wStep('lb'))) expect(Number(wDisplay(s.w, 'lb')) % 5).toBe(0);
  });
  it('el diente del valor actual existe en la ventana (si no, la rueda no se centra)', () => {
    const step = wStep('lb');
    const val = wFromUnit(175, 'lb');
    const onValue = Math.round(Math.round(val / step) * step * 100) / 100;
    expect(reelValues(val, step, 0.5)).toContain(onValue);
  });
});
