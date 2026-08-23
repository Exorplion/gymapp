import { EXDB, exInfo, LOWBACK, isLowerBackLift, rirScheme, sessionMaxW, progressionWarn } from './exdb.js';
import { S } from './state.js';

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

  describe('sessionMaxW', () => {
    test('finds the max weight for an exercise across its sets in a session', () => {
      const session = {
        entries: [
          { name: 'Press banca', sets: [{ w: 60 }, { w: 65 }, { w: 62.5 }] },
          { name: 'Sentadilla', sets: [{ w: 100 }] },
        ],
      };
      expect(sessionMaxW(session, 'press banca')).toBe(65);
    });

    test('returns null when the exercise is not in the session', () => {
      const session = { entries: [{ name: 'Sentadilla', sets: [{ w: 100 }] }] };
      expect(sessionMaxW(session, 'press banca')).toBeNull();
    });

    test('returns null when the exercise has no sets', () => {
      const session = { entries: [{ name: 'Press banca', sets: [] }] };
      expect(sessionMaxW(session, 'press banca')).toBeNull();
    });
  });

  describe('progressionWarn', () => {
    afterEach(() => { S.sessions = []; });

    test('warns when current weight is below the last session\'s max (which was a raise over the prior one)', () => {
      S.sessions = [
        { entries: [{ name: 'Press banca', sets: [{ w: 65 }] }] }, // last (más reciente, index 0)
        { entries: [{ name: 'Press banca', sets: [{ w: 60 }] }] }, // prev
      ];
      const warn = progressionWarn('press banca', 62.5);
      expect(warn).not.toBeNull();
      expect(warn).toMatch(/65/);
    });

    test('does not warn when current weight equals the last max', () => {
      S.sessions = [
        { entries: [{ name: 'Press banca', sets: [{ w: 65 }] }] },
        { entries: [{ name: 'Press banca', sets: [{ w: 60 }] }] },
      ];
      expect(progressionWarn('press banca', 65)).toBeNull();
    });

    test('does not warn when current weight is above the last max', () => {
      S.sessions = [
        { entries: [{ name: 'Press banca', sets: [{ w: 65 }] }] },
        { entries: [{ name: 'Press banca', sets: [{ w: 60 }] }] },
      ];
      expect(progressionWarn('press banca', 70)).toBeNull();
    });

    test('does not warn when there is not enough history', () => {
      S.sessions = [{ entries: [{ name: 'Press banca', sets: [{ w: 65 }] }] }];
      expect(progressionWarn('press banca', 60)).toBeNull();
    });
  });
});
