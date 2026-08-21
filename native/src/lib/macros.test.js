import { S } from './state.js';
import {
  ACTF, ACT_LABEL, ACT_HINT, GOALDELTA, GOAL_LABEL, GOAL_HINT,
  profileWeight, computeMacros, applyComputedGoals,
} from './macros.js';

describe('macros.js — motor de macros', () => {
  beforeEach(() => {
    S.cfg.profile = { sex: 'm', age: null, height: null, weightKg: null, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 };
    S.cfg.goalsAuto = false;
    S.cfg.goals = { kcal: 2600, p: 160, c: 280, f: 80 };
    S.body = [];
  });

  describe('constantes', () => {
    it('exponen las tablas esperadas', () => {
      expect(ACTF.moderate).toBe(1.55);
      expect(ACT_LABEL.high).toBe('Alto');
      expect(ACT_HINT.sedentary).toBeDefined();
      expect(GOALDELTA.deficit_agg).toBe(-500);
      expect(GOAL_LABEL.maintenance).toBe('Mantenimiento');
      expect(GOAL_HINT.surplus).toBeDefined();
    });
  });

  describe('profileWeight()', () => {
    it('usa el peso del perfil si está', () => {
      S.cfg.profile.weightKg = 80;
      expect(profileWeight()).toBe(80);
    });

    it('cae al último registro de S.body si el perfil no tiene peso', () => {
      S.body = [{ date: '2026-08-01', weight: 75 }, { date: '2026-08-10', weight: 74 }];
      expect(profileWeight()).toBe(74);
    });

    it('devuelve null si no hay perfil ni body con peso', () => {
      S.body = [{ date: '2026-08-01', weight: null }];
      expect(profileWeight()).toBeNull();
    });
  });

  describe('computeMacros()', () => {
    it('devuelve null si falta edad/altura/peso', () => {
      expect(computeMacros()).toBeNull();
    });

    it('calcula macros completos con perfil válido', () => {
      S.cfg.profile = { sex: 'm', age: 30, height: 175, weightKg: 80, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 };
      const m = computeMacros();
      expect(m).not.toBeNull();
      expect(m.weight).toBe(80);
      expect(m.bmr).toBe(Math.round(10 * 80 + 6.25 * 175 - 5 * 30 + 5));
      expect(m.tdeeCalc).toBe(Math.round(m.bmr * 1.55));
      expect(m.tdee).toBe(m.tdeeCalc);
      expect(m.target).toBe(Math.max(0, Math.round(m.tdee - 300)));
      expect(m.carbs).toBeGreaterThanOrEqual(0);
    });

    it('usa tdeeEmpirical cuando está presente y > 0', () => {
      S.cfg.profile = { sex: 'f', age: 25, height: 165, weightKg: 60, activity: 'light', goal: 'maintenance', tdeeEmpirical: 1900, proteinPref: 0.5, fatPref: 0.5 };
      const m = computeMacros();
      expect(m.empirical).toBe(1900);
      expect(m.tdee).toBe(1900);
    });
  });

  describe('applyComputedGoals()', () => {
    it('devuelve false si goalsAuto es false', () => {
      expect(applyComputedGoals()).toBe(false);
    });

    it('devuelve false si el perfil está incompleto aunque goalsAuto sea true', () => {
      S.cfg.goalsAuto = true;
      expect(applyComputedGoals()).toBe(false);
    });

    it('actualiza S.cfg.goals cuando el perfil está completo y goalsAuto es true', () => {
      S.cfg.goalsAuto = true;
      S.cfg.profile = { sex: 'm', age: 30, height: 175, weightKg: 80, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 };
      const ok = applyComputedGoals();
      expect(ok).toBe(true);
      const m = computeMacros();
      expect(S.cfg.goals).toEqual({ kcal: m.target, p: m.prot, c: m.carbs, f: m.fat });
    });
  });
});
