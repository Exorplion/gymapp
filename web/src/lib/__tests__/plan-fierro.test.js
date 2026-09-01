// Tests de la lógica nueva del Plan Fierro (Fases 1-3). Todo lo que se
// prueba acá son funciones puras sobre S: se arma el estado a mano, se
// llama, se compara. No hay DOM ni IndexedDB en juego.
import { describe, it, expect, beforeEach } from 'vitest';
import { S } from '../state.js';
import { volumeBand, strengthTier, acwr, suggestedWeight } from '../charts.js';
import { recoveryPct } from '../muscle.js';
import { lifetimeTonnage, recallYearAgo, yearRecap } from '../session.js';
import { expectedWeeklyRate, weeklyBandAdjustment, computeAdaptiveTDEE } from '../macros.js';
import { microsOfDay, lowMicros } from '../micronutrients.js';
import { dstr } from '../format.js';

const DIA = 86400000;
/** Fecha YYYY-MM-DD de hace `n` días. */
const hace = n => dstr(new Date(Date.now() - n * DIA));

function sesion({ dias = 0, name = 'Press banca', cat, sets = [{ w: 100, r: 5 }] }) {
  const start = Date.now() - dias * DIA;
  return {
    id: `s${dias}-${name}`, date: hace(dias), start, end: start + 3600e3, duration: 60,
    entries: [{ name, cat, sets: sets.map(s => ({ ...s, t: start })) }],
  };
}

beforeEach(() => {
  S.sessions = [];
  S.body = [];
  S.meals = [];
  S.cfg.profile = { sex: 'm', age: 30, height: 175, weightKg: 80, activity: 'moderate', goal: 'deficit_mod', tdeeEmpirical: null, proteinPref: 0.5, fatPref: 0.5 };
  S.cfg.tdeeCheckedDate = null;
});

describe('volumeBand — bandas MEV/MAV/MRV (Fase 1)', () => {
  it('clasifica según los umbrales del grupo, no un genérico', () => {
    // Pecho: mev 8, mav 16, mrv 22
    expect(volumeBand('Pecho', 4)).toBe('bajo');
    expect(volumeBand('Pecho', 12)).toBe('efectivo');
    expect(volumeBand('Pecho', 18)).toBe('cerca-max');
    expect(volumeBand('Pecho', 25)).toBe('excedido');
  });

  it('cada grupo usa su propia tabla', () => {
    // 12 series es "efectivo" en Pecho (mav 16) pero ya toca el máximo en Glúteo (mav 12)
    expect(volumeBand('Pecho', 12)).toBe('efectivo');
    expect(volumeBand('Glúteo', 12)).toBe('cerca-max');
  });

  it('un grupo sin tabla propia no explota', () => {
    expect(volumeBand('GrupoInventado', 12)).toBe('efectivo');
  });
});

describe('strengthTier — fuerza contra peso corporal (Fase 1)', () => {
  it('ubica el tier por múltiplo del peso corporal', () => {
    // tiers de sentadilla: 0.75 / 1.25 / 1.75 / 2.25 × peso corporal.
    // El umbral es inclusivo: caer justo en 1.75× ya es Avanzado.
    expect(strengthTier('Sentadilla', 140, 80)).toEqual({ label: 'Avanzado', ratio: 1.75 });
    expect(strengthTier('Sentadilla', 120, 80)).toEqual({ label: 'Intermedio', ratio: 1.5 });
    expect(strengthTier('Sentadilla', 60, 80)).toEqual({ label: 'Principiante', ratio: 0.75 });
    expect(strengthTier('Sentadilla', 200, 80)).toEqual({ label: 'Élite', ratio: 2.5 });
  });

  it('sólo aplica a los cuatro grandes', () => {
    expect(strengthTier('Curl martillo', 30, 80)).toBeNull();
  });

  it('no confunde una variante con el levantamiento base', () => {
    expect(strengthTier('Press inclinado', 100, 80)).toBeNull();
    expect(strengthTier('Peso muerto rumano', 150, 80)).toBeNull();
    expect(strengthTier('Peso muerto', 160, 80)).not.toBeNull();
  });

  it('sin peso corporal no inventa un ratio', () => {
    expect(strengthTier('Sentadilla', 140, null)).toBeNull();
  });
});

describe('acwr — riesgo por salto de volumen (Fase 2)', () => {
  it('null sin historial de 4 semanas', () => {
    expect(acwr()).toBeNull();
  });

  it('detecta la semana que se dispara sobre el promedio', () => {
    // 3 semanas tranquilas + una semana muy cargada
    S.sessions = [
      sesion({ dias: 1, sets: [{ w: 100, r: 10 }, { w: 100, r: 10 }, { w: 100, r: 10 }] }), // 3000 kg
      sesion({ dias: 10, name: 'A', sets: [{ w: 50, r: 10 }] }),  // 500
      sesion({ dias: 17, name: 'B', sets: [{ w: 50, r: 10 }] }),  // 500
      sesion({ dias: 24, name: 'C', sets: [{ w: 50, r: 10 }] }),  // 500
    ];
    const r = acwr();
    // agudo 3000, crónico (4500/4)=1125 → ratio 2.67
    expect(r.acute).toBe(3000);
    expect(r.risk).toBe(true);
  });

  it('una carga estable no dispara la alerta', () => {
    S.sessions = [0, 7, 14, 21].map(d => sesion({ dias: d + 1, name: `E${d}`, sets: [{ w: 100, r: 10 }] }));
    expect(acwr().risk).toBe(false);
  });
});

describe('recoveryPct — recuperación por esfuerzo, no solo días (Fase 2)', () => {
  it('100% sin historial del grupo', () => {
    expect(recoveryPct('Pecho')).toBe(100);
  });

  it('un RPE alto tarda más en recuperar que uno bajo, a los mismos días', () => {
    S.sessions = [sesion({ dias: 2, cat: 'Pecho', sets: [{ w: 100, r: 5, rpe: 10 }] })];
    const duro = recoveryPct('Pecho');
    S.sessions = [sesion({ dias: 2, cat: 'Pecho', sets: [{ w: 100, r: 5, rpe: 4 }] })];
    const suave = recoveryPct('Pecho');
    expect(duro).toBeLessThan(suave);
  });

  it('sin RPE registrado usa la referencia media y sigue dando un número', () => {
    S.sessions = [sesion({ dias: 2, cat: 'Pecho', sets: [{ w: 100, r: 5 }] })];
    expect(recoveryPct('Pecho')).toBe(100); // 2 días / 2 días de referencia
  });

  it('nunca pasa de 100', () => {
    S.sessions = [sesion({ dias: 30, cat: 'Pecho', sets: [{ w: 100, r: 5, rpe: 10 }] })];
    expect(recoveryPct('Pecho')).toBe(100);
  });
});

describe('lifetimeTonnage y recallYearAgo (Fase 1)', () => {
  it('suma peso × reps de toda la historia', () => {
    S.sessions = [
      sesion({ dias: 1, sets: [{ w: 100, r: 5 }] }),   // 500
      sesion({ dias: 5, name: 'B', sets: [{ w: 50, r: 10 }] }), // 500
    ];
    expect(lifetimeTonnage()).toBe(1000);
  });

  it('recall encuentra la sesión de hace ~1 año y sólo esa', () => {
    S.sessions = [
      sesion({ dias: 5, name: 'Sentadilla', sets: [{ w: 120, r: 5 }] }),
      sesion({ dias: 365, name: 'Sentadilla', sets: [{ w: 90, r: 5 }] }),
    ];
    const r = recallYearAgo('Sentadilla');
    expect(r.sets[0].w).toBe(90);
  });

  it('null si no hay nada en la ventana de 330-400 días', () => {
    S.sessions = [sesion({ dias: 200, name: 'Sentadilla' })];
    expect(recallYearAgo('Sentadilla')).toBeNull();
  });
});

describe('yearRecap — Tu Año Fierro (Fase 3)', () => {
  it('null sin sesiones en el año', () => {
    expect(yearRecap()).toBeNull();
  });

  it('sintetiza kg, series, ejercicio top y PR más grande', () => {
    S.sessions = [
      sesion({ dias: 2, name: 'Sentadilla', sets: [{ w: 100, r: 5 }, { w: 110, r: 3 }] }),
      sesion({ dias: 9, name: 'Press banca', sets: [{ w: 80, r: 8 }] }),
    ];
    const r = yearRecap();
    expect(r.sesiones).toBe(2);
    expect(r.series).toBe(3);
    expect(r.kg).toBe(100 * 5 + 110 * 3 + 80 * 8);
    expect(r.ejercicioTop.name).toBe('Sentadilla');
    expect(r.prMasGrande.w).toBe(110);
  });

  it('ignora lo que quedó fuera de los 365 días', () => {
    S.sessions = [sesion({ dias: 400, name: 'Vieja' }), sesion({ dias: 3, name: 'Nueva' })];
    expect(yearRecap().sesiones).toBe(1);
  });
});

describe('suggestedWeight — peso por % de 1RM (Fase 3)', () => {
  it('null sin historial del ejercicio', () => {
    expect(suggestedWeight('Sentadilla')).toBeNull();
  });

  it('calcula sobre el e1RM más reciente', () => {
    // e1RM Epley de 100×5 = 100 * (1 + 5/30) = 116.67 → 80% ≈ 93.33
    S.sessions = [sesion({ dias: 2, name: 'Sentadilla', sets: [{ w: 100, r: 5 }] })];
    const sug = suggestedWeight('Sentadilla');
    expect(sug).toBeGreaterThan(90);
    expect(sug).toBeLessThan(95);
  });

  it('el porcentaje es configurable', () => {
    S.sessions = [sesion({ dias: 2, name: 'Sentadilla', sets: [{ w: 100, r: 5 }] })];
    expect(suggestedWeight('Sentadilla', 0.9)).toBeGreaterThan(suggestedWeight('Sentadilla', 0.7));
  });
});

describe('ajuste de calorías por bandas (Fase 2)', () => {
  it('el ritmo esperado sale del objetivo, con signo', () => {
    S.cfg.profile.goal = 'deficit_mod'; // -300 kcal/día
    expect(expectedWeeklyRate()).toBeCloseTo((-300 * 7) / 7700, 3);
    S.cfg.profile.goal = 'maintenance';
    expect(expectedWeeklyRate()).toBe(0);
  });

  it('null sin suficientes registros de peso', () => {
    S.body = [{ date: hace(1), weight: 80 }];
    expect(weeklyBandAdjustment()).toBeNull();
  });

  it('sugiere recortar si bajás más lento de lo esperado', () => {
    // objetivo deficit_mod ≈ -0.27 kg/sem; real: subió 0.5 kg en 14 días
    S.body = [{ date: hace(14), weight: 80 }, { date: hace(0), weight: 80.5 }];
    expect(weeklyBandAdjustment().adjust).toBe(-100);
  });

  it('sugiere sumar si bajás más rápido de lo esperado', () => {
    S.body = [{ date: hace(14), weight: 82 }, { date: hace(0), weight: 80 }];
    expect(weeklyBandAdjustment().adjust).toBe(100);
  });

  it('no toca nada si el ritmo real está en rango', () => {
    // deficit_mod espera ≈ -0.27 kg/sem → en 14 días, ≈ -0.55 kg
    S.body = [{ date: hace(14), weight: 80.55 }, { date: hace(0), weight: 80 }];
    expect(weeklyBandAdjustment().adjust).toBe(0);
  });
});

describe('computeAdaptiveTDEE — el campo muerto que se vuelve motor (Fase 3)', () => {
  it('null sin las dos semanas de peso', () => {
    S.body = [{ date: hace(1), weight: 80 }];
    expect(computeAdaptiveTDEE()).toBeNull();
  });

  it('null si hay peso pero no comidas suficientes', () => {
    S.body = [{ date: hace(10), weight: 81 }, { date: hace(1), weight: 80 }];
    expect(computeAdaptiveTDEE()).toBeNull();
  });

  it('despeja el gasto real desde intake y cambio de peso', () => {
    S.body = [{ date: hace(10), weight: 81 }, { date: hace(1), weight: 80.5 }];
    // 6 días con 2000 kcal registradas
    for (let i = 0; i < 6; i++) {
      S.meals.push({ id: `m${i}`, date: hace(i), name: 'comida', kcal: 2000, p: 150, c: 200, f: 60, t: '12:00' });
    }
    const r = computeAdaptiveTDEE();
    expect(r).not.toBeNull();
    expect(r.intakeAvg).toBe(2000);
    // bajó peso comiendo 2000 → el gasto real tiene que ser MÁS que 2000
    expect(r.tdee).toBeGreaterThan(2000);
  });
});

describe('micronutrientes clave (Fase 3)', () => {
  it('suma micros desde la tabla de alimentos', () => {
    S.meals = [{ id: 'm1', date: hace(0), name: 'pollo', kcal: 165, p: 31, c: 0, f: 3.6, t: '12:00' }];
    const r = microsOfDay(hace(0));
    // 165 kcal de pollo ≈ 100g → fe 0.7
    expect(r.total.fe).toBeCloseTo(0.7, 1);
    expect(r.coverage).toBe(1);
  });

  it('un alimento sin datos no cuenta como cero: baja la cobertura', () => {
    S.meals = [{ id: 'm1', date: hace(0), name: 'algo raro', kcal: 500, p: 10, c: 50, f: 20, t: '12:00' }];
    const r = microsOfDay(hace(0));
    expect(r.coverage).toBe(0);
  });

  it('no avisa nada sin al menos 5 días con datos', () => {
    S.meals = [{ id: 'm1', date: hace(0), name: 'pollo', kcal: 165, p: 31, c: 0, f: 3.6, t: '12:00' }];
    expect(lowMicros()).toEqual([]);
  });

  it('avisa el nutriente bajo cuando el patrón se sostiene 5+ días', () => {
    // 7 días comiendo sólo pollo: vitamina D y omega-3 quedan en cero
    for (let i = 0; i < 7; i++) {
      S.meals.push({ id: `m${i}`, date: hace(i), name: 'pollo', kcal: 165, p: 31, c: 0, f: 3.6, t: '12:00' });
    }
    const bajos = lowMicros().map(b => b.k);
    expect(bajos).toContain('vitd');
    expect(bajos).toContain('omega3');
  });
});
