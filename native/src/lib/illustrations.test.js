import { ILLUS, illusUrl, searchIllus } from './illustrations.js';

describe('illustrations', () => {
  test('ILLUS is a non-empty array of {id, name, equipment, muscles}', () => {
    expect(Array.isArray(ILLUS)).toBe(true);
    expect(ILLUS.length).toBeGreaterThan(0);
    const it = ILLUS[0];
    expect(typeof it.id).toBe('string');
    expect(typeof it.name).toBe('string');
    expect(Array.isArray(it.muscles)).toBe(true);
  });

  describe('illusUrl', () => {
    test('builds the raw.githubusercontent CDN url for an id', () => {
      expect(illusUrl('3_4_Sit-Up')).toBe(
        'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/0.jpg'
      );
    });
  });

  describe('searchIllus', () => {
    test('returns [] for an empty/untranslatable query', () => {
      expect(searchIllus('')).toEqual([]);
    });

    test('finds results for "press banca" via the ES_EN translation layer', () => {
      const results = searchIllus('press banca');
      expect(results.length).toBeGreaterThan(0);
      const names = results.map(r => r.name.toLowerCase());
      expect(names.some(n => n.includes('bench'))).toBe(true);
    });

    test('finds results for "sentadilla" (squat)', () => {
      const results = searchIllus('sentadilla');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name.toLowerCase().includes('squat'))).toBe(true);
    });

    test('handles a two-word phrase synonym ("peso muerto" -> deadlift)', () => {
      const results = searchIllus('peso muerto');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name.toLowerCase().includes('deadlift'))).toBe(true);
    });

    test('respects the limit parameter', () => {
      const results = searchIllus('curl', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});
