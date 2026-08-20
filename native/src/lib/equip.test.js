// Tests nuevos para equip.js — la PWA no tiene equip.test.js (se buscó en
// web/src/lib/__tests__/ y no existe), así que estos son de cero. Cubren
// las funciones exportadas más usadas por rutina-logic.js/session.js
// (exKey, sobre todo), por lo que exige el brief de Task 1.
import { exKey, equipLabel, isMachineBound, relatedHistory, EQUIP } from './equip.js';

describe('exKey', () => {
  it('sin equipo declarado, la clave es sólo el nombre normalizado', () => {
    expect(exKey({ name: 'Press banca' })).toBe('press banca');
    expect(exKey({ name: '  Press Banca  ' })).toBe('press banca');
  });

  it('con equipo no ligado a máquina, la clave suma el equipo', () => {
    expect(exKey({ name: 'Press banca', equip: 'barra' })).toBe('press banca·barra');
  });

  it('con equipo ligado a máquina (discos/placas/polea) y machine declarado, la clave suma ambos', () => {
    expect(exKey({ name: 'Remo', equip: 'placas', machine: 'Life Fitness' }))
      .toBe('remo·placas·life fitness');
  });

  it('equipo ligado a máquina sin machine declarado no agrega el sufijo de máquina', () => {
    expect(exKey({ name: 'Remo', equip: 'placas' })).toBe('remo·placas');
  });

  it('dos ejercicios con mismo nombre y equipo pero distinta máquina generan claves distintas', () => {
    const a = exKey({ name: 'Remo', equip: 'polea', machine: 'A' });
    const b = exKey({ name: 'Remo', equip: 'polea', machine: 'B' });
    expect(a).not.toBe(b);
  });
});

describe('isMachineBound', () => {
  it('discos/placas/polea son machine-bound', () => {
    expect(isMachineBound('discos')).toBe(true);
    expect(isMachineBound('placas')).toBe(true);
    expect(isMachineBound('polea')).toBe(true);
  });

  it('barra/mancuernas/smith/corporal no lo son', () => {
    expect(isMachineBound('barra')).toBe(false);
    expect(isMachineBound('mancuernas')).toBe(false);
    expect(isMachineBound('smith')).toBe(false);
    expect(isMachineBound('corporal')).toBe(false);
  });
});

describe('equipLabel', () => {
  it('sin equip devuelve string vacío', () => {
    expect(equipLabel({ name: 'Press banca' })).toBe('');
  });

  it('con equip y sin machine devuelve sólo la etiqueta del equipo', () => {
    expect(equipLabel({ name: 'Press banca', equip: 'barra' })).toBe('Barra');
  });

  it('con equip y machine combina ambos', () => {
    expect(equipLabel({ name: 'Remo', equip: 'placas', machine: 'Life Fitness' }))
      .toBe('Placas · Life Fitness');
  });
});

describe('EQUIP', () => {
  it('tiene los siete sistemas de carga documentados', () => {
    expect(EQUIP.map(e => e.id)).toEqual(['barra', 'mancuernas', 'discos', 'placas', 'polea', 'smith', 'corporal']);
  });
});

describe('relatedHistory', () => {
  it('devuelve el historial del mismo ejercicio con OTRO equipo, no el propio', () => {
    const sessions = [
      {
        date: '2026-08-01',
        entries: [
          { name: 'Press banca', equip: 'barra', sets: [{ w: 60, r: 8 }] },
          { name: 'Press banca', equip: 'discos', machine: 'Hammer', sets: [{ w: 40, r: 10 }] },
        ],
      },
    ];
    const ex = { name: 'Press banca', equip: 'barra' };
    const rel = relatedHistory(ex, sessions);
    expect(rel).toHaveLength(1);
    expect(rel[0]).toMatchObject({ label: 'Discos · Hammer', w: 40, r: 10 });
  });

  it('sin nombre no explota y devuelve lista vacía', () => {
    expect(relatedHistory({ name: '' }, [])).toEqual([]);
  });
});
