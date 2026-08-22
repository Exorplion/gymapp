import { EXDB, exInfo, LOWBACK, isLowerBackLift, rirScheme } from './exdb.js';

describe('exdb', () => {
  test('EXDB is a non-empty array of entries with k/m/w', () => {
    expect(Array.isArray(EXDB)).toBe(true);
    expect(EXDB.length).toBeGreaterThan(0);
    for (const e of EXDB) {
      expect(Array.isArray(e.k)).toBe(true);
      expect(typeof e.m).toBe('string');
      expect(typeof e.w).toBe('string');
    }
  });

  describe('exInfo', () => {
    test('matches "press banca" to the pecho/tríceps entry', () => {
      const info = exInfo('press banca');
      expect(info).not.toBeNull();
      expect(info.m).toMatch(/Pectoral mayor/);
    });

    test('matches accented/uppercase variants via norm()', () => {
      const info = exInfo('PRESS DE BANCA');
      expect(info).not.toBeNull();
      expect(info.m).toMatch(/Pectoral mayor/);
    });

    test('prefers the longest matching keyword ("peso muerto rumano" over "peso muerto")', () => {
      const info = exInfo('peso muerto rumano');
      expect(info).not.toBeNull();
      expect(info.m).toMatch(/Femoral/);
    });

    test('returns null when nothing matches', () => {
      expect(exInfo('ejercicio que no existe xyz')).toBeNull();
    });
  });

  describe('isLowerBackLift / LOWBACK', () => {
    test('LOWBACK is a non-empty array of keywords', () => {
      expect(Array.isArray(LOWBACK)).toBe(true);
      expect(LOWBACK.length).toBeGreaterThan(0);
    });

    test('identifies a lower-back lift ("rumano")', () => {
      expect(isLowerBackLift('peso muerto rumano')).toBe(true);
    });

    test('identifies a normal lift as not lower-back', () => {
      expect(isLowerBackLift('press banca')).toBe(false);
    });
  });

  describe('rirScheme', () => {
    test('normal lift: last set at RIR 0, counting down', () => {
      expect(rirScheme(3, 'press banca')).toEqual([2, 1, 0]);
    });

    test('lower-back lift: capped at RIR 1, never reaches 0', () => {
      expect(rirScheme(3, 'rumano')).toEqual([3, 2, 1]);
    });

    test('at least 1 set even if nSets is 0', () => {
      expect(rirScheme(0, 'press banca')).toHaveLength(1);
    });
  });
});
