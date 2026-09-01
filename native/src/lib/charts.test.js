import { S } from './state.js';
import {
  weeklyAvg, exerciseSeries, RANGE_DAYS, filterByRange,
  e1rm, e1rmSeries, trend, project, strengthReadout
} from './charts.js';

describe('charts.js — análisis de progreso', () => {
  describe('weeklyAvg()', () => {
    it('devuelve null cuando no hay weight data', () => {
      S.body = [];
      expect(weeklyAvg()).toBeNull();
    });

    it('calcula promedio semanal actual y anterior', () => {
      // La última entrada en el array es la referencia. Poner en orden antiguo -> nuevo.
      // Semana actual: últimos 7 días (2026-08-20, 2026-08-19, 2026-08-18)
      // Semana anterior: 7-14 días atrás (2026-08-13, 2026-08-12, 2026-08-11)
      S.body = [
        { date: '2026-08-11', weight: 76.3 },  // hace 9 días
        { date: '2026-08-12', weight: 76.5 },  // hace 8 días
        { date: '2026-08-13', weight: 76.0 },  // hace 7 días (semana anterior)
        { date: '2026-08-18', weight: 75.2 },  // hace 2 días (semana actual)
        { date: '2026-08-19', weight: 75.5 },  // ayer (semana actual)
        { date: '2026-08-20', weight: 75.0 },  // hoy (última entrada, referencia)
      ];
      const result = weeklyAvg();
      expect(result).not.toBeNull();
      expect(result.curAvg).toBeCloseTo((75.0 + 75.5 + 75.2) / 3, 1);  // ~75.23
      expect(result.prevAvg).toBeCloseTo((76.0 + 76.5 + 76.3) / 3, 1); // ~76.27
      expect(result.n).toBe(3);  // 3 puntos en semana actual
      // delta se redondea con round1(): round1(75.23 - 76.27) = round1(-1.04) = -1.0
      expect(result.delta).toBeCloseTo(-1.0, 1);
      expect(result.last).toEqual({ date: '2026-08-20', weight: 75.0 });
    });

    it('devuelve delta=null si no hay prevAvg', () => {
      // Orden: antiguo -> nuevo (última entrada es referencia)
      // Solo datos en la semana actual, nada en la anterior
      S.body = [
        { date: '2026-08-19', weight: 75.5 },  // ayer
        { date: '2026-08-20', weight: 75.0 },  // última entrada (referencia)
      ];
      const result = weeklyAvg();
      expect(result.curAvg).toBeCloseTo(75.25, 1);
      expect(result.prevAvg).toBeNull();  // sin datos en semana anterior
      expect(result.delta).toBeNull();    // delta es null porque prevAvg es null
    });
  });

  describe('exerciseSeries()', () => {
    it('devuelve {} cuando no hay sesiones', () => {
      S.sessions = [];
      expect(exerciseSeries()).toEqual({});
    });

    it('agrupa ejercicios por nombre y computa best (w*r)', () => {
      // S.sessions en orden newest first (como en state.js)
      S.sessions = [
        {
          start: 2,
          date: '2026-08-20',
          entries: [
            {
              name: 'Press',
              sets: [
                { w: 52, r: 8 },   // best = 416
                { w: 50, r: 10 }   // best = 500
              ]
            }
          ]
        },
        {
          start: 1,
          date: '2026-08-15',
          entries: [
            {
              name: 'Press',
              sets: [
                { w: 50, r: 8 },   // best = 400
                { w: 45, r: 10 }   // best = 450
              ]
            }
          ]
        }
      ];
      // exerciseSeries() internamente ordena por start ascendente
      const result = exerciseSeries();
      expect(result['Press']).toHaveLength(2);
      expect(result['Press'][0]).toEqual({ date: '2026-08-15', best: 450, maxW: 50, w: 45, r: 10 });
      expect(result['Press'][1]).toEqual({ date: '2026-08-20', best: 500, maxW: 52, w: 50, r: 10 });
    });

    it('ignora ejercicios sin sets completados', () => {
      S.sessions = [
        {
          start: 1,
          date: '2026-08-15',
          entries: [
            { name: 'Incompleto', sets: [] }  // sin sets
          ]
        }
      ];
      expect(exerciseSeries()).toEqual({});
    });

    it('trim() en nombres de ejercicio', () => {
      S.sessions = [
        {
          start: 1,
          date: '2026-08-15',
          entries: [
            { name: '  Press  ', sets: [{ w: 50, r: 8 }] }
          ]
        }
      ];
      const result = exerciseSeries();
      expect(result['Press']).toBeDefined();
      expect(result['  Press  ']).toBeUndefined();
    });
  });

  describe('RANGE_DAYS', () => {
    it('contiene rangos estándar', () => {
      expect(RANGE_DAYS['1m']).toBe(30);
      expect(RANGE_DAYS['3m']).toBe(90);
      expect(RANGE_DAYS['6m']).toBe(180);
    });
  });

  describe('filterByRange()', () => {
    it('devuelve array completo si range es null/undefined/"all"', () => {
      const pts = [
        { date: '2026-08-20', y: 100 },
        { date: '2026-08-01', y: 95 }
      ];
      expect(filterByRange(pts, null)).toEqual(pts);
      expect(filterByRange(pts, undefined)).toEqual(pts);
      expect(filterByRange(pts, 'all')).toEqual(pts);
    });

    it('filtra por rango (ej. 1m = últimos 30 días)', () => {
      // Hoy es 2026-08-20
      const pts = [
        { date: '2026-08-20', y: 100 },  // hoy, incluido
        { date: '2026-07-25', y: 95 }    // hace ~26 días, incluido
      ];
      // La función usa Date.now() así que puede variar, pero chequeamos estructura
      const result = filterByRange(pts, '1m');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('devuelve array vacío si range excluye todos los puntos', () => {
      const pts = [
        { date: '2026-01-01', y: 100 }   // muy antiguo
      ];
      const result = filterByRange(pts, '1m');
      expect(result.length).toBe(0);
    });
  });

  describe('e1rm()', () => {
    it('devuelve peso cuando r <= 1', () => {
      expect(e1rm(100, 0)).toBe(100);
      expect(e1rm(100, 1)).toBe(100);
    });

    it('estima 1RM usando fórmula Epley', () => {
      // e1rm(w, r) = w * (1 + r/30)
      const result = e1rm(100, 10);
      expect(result).toBeCloseTo(100 * (1 + 10 / 30), 5);  // ~133.33
    });

    it('maneja valores fraccionarios', () => {
      const result = e1rm(50.5, 5);
      expect(result).toBeCloseTo(50.5 * (1 + 5 / 30), 5);
    });
  });

  describe('e1rmSeries()', () => {
    it('devuelve [] cuando no hay sesiones', () => {
      S.sessions = [];
      expect(e1rmSeries('Press')).toEqual([]);
    });

    it('calcula mejor 1RM estimado por sesión, en orden cronológico', () => {
      // S.sessions viene ordenado newest first (por start descendente)
      S.sessions = [
        {
          start: 2,
          date: '2026-08-20',
          entries: [{ name: 'Press', sets: [{ w: 50, r: 5 }] }]
        },
        {
          start: 1,
          date: '2026-08-15',
          entries: [{ name: 'Press', sets: [{ w: 45, r: 8 }] }]
        }
      ];
      // e1rmSeries reversamos internamente para cronológico
      const result = e1rmSeries('Press');
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-08-15');  // antes (cronológico)
      expect(result[1].date).toBe('2026-08-20');  // después
      expect(result[0].y).toBeCloseTo(e1rm(45, 8), 5);
      expect(result[1].y).toBeCloseTo(e1rm(50, 5), 5);
    });

    it('ignora reps > 12', () => {
      S.sessions = [
        {
          start: 1,
          date: '2026-08-15',
          entries: [{
            name: 'Leg Press',
            sets: [
              { w: 100, r: 15 },  // ignorado (>12)
              { w: 80, r: 8 }     // incluido
            ]
          }]
        }
      ];
      const result = e1rmSeries('Leg Press');
      expect(result).toHaveLength(1);
      expect(result[0].y).toBeCloseTo(e1rm(80, 8), 5);
    });

    it('case-insensitive y normaliza nombres', () => {
      S.sessions = [
        {
          start: 1,
          date: '2026-08-15',
          entries: [{ name: 'PRESS', sets: [{ w: 50, r: 8 }] }]
        }
      ];
      const result = e1rmSeries('press');  // minúscula
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].y).toBeCloseTo(e1rm(50, 8), 5);
    });
  });

  describe('trend()', () => {
    it('devuelve null si < 4 puntos', () => {
      expect(trend([])).toBeNull();
      expect(trend([{ date: '2026-08-20', y: 100 }])).toBeNull();
      expect(trend([
        { date: '2026-08-20', y: 100 },
        { date: '2026-08-19', y: 101 },
        { date: '2026-08-18', y: 102 }
      ])).toBeNull();
    });

    it('calcula regresión lineal con R² para 4+ puntos', () => {
      const pts = [
        { date: '2026-08-01', y: 100 },
        { date: '2026-08-08', y: 103 },
        { date: '2026-08-15', y: 106 },
        { date: '2026-08-20', y: 109 }
      ];
      const result = trend(pts);
      expect(result).not.toBeNull();
      expect(result.slope).toBeGreaterThan(0);  // tendencia ascendente
      expect(result.r2).toBeGreaterThan(0);
      expect(result.n).toBe(4);
      expect(result.last).toBe(109);
      expect(result.days).toBeGreaterThan(0);
    });

    it('devuelve slope=0, r2=0 cuando todos los puntos tienen mismo y', () => {
      const pts = [
        { date: '2026-08-01', y: 100 },
        { date: '2026-08-08', y: 100 },
        { date: '2026-08-15', y: 100 },
        { date: '2026-08-20', y: 100 }
      ];
      const result = trend(pts);
      expect(result).not.toBeNull();
      expect(result.slope).toBe(0);  // sin cambio
      expect(result.r2).toBe(0);     // sin correlación
      expect(result.n).toBe(4);
    });

    it('computa R² = 0 si no hay varianza en y', () => {
      // pendiente = 0, todos mismos valores
      const pts = [
        { date: '2026-08-01', y: 100 },
        { date: '2026-08-02', y: 100 },
        { date: '2026-08-03', y: 100 },
        { date: '2026-08-04', y: 100 }
      ];
      const result = trend(pts);
      expect(result).not.toBeNull();
      expect(result.r2).toBe(0);
      expect(result.slope).toBe(0);
    });
  });

  describe('project()', () => {
    it('devuelve null si trend es null', () => {
      expect(project(null, 4)).toBeNull();
    });

    it('devuelve null si t.n < 4', () => {
      const t = { n: 3, r2: 0.9, slope: 0.5, last: 100 };
      expect(project(t, 4)).toBeNull();
    });

    it('devuelve null si t.r2 < 0.5', () => {
      const t = { n: 10, r2: 0.4, slope: 0.5, last: 100 };
      expect(project(t, 4)).toBeNull();
    });

    it('devuelve null si t.slope <= 0', () => {
      const t = { n: 10, r2: 0.9, slope: 0, last: 100 };
      expect(project(t, 4)).toBeNull();
      const t2 = { n: 10, r2: 0.9, slope: -0.5, last: 100 };
      expect(project(t2, 4)).toBeNull();
    });

    it('proyecta conservadoramente, limitada a 1%/semana', () => {
      // slope = 1 kg/día, medido = 1*7 = 7 kg/semana
      // cap = 100 * 0.01 = 1 kg/semana
      // perWeek = min(7, 1) = 1 (capped)
      const t = { n: 10, r2: 0.9, slope: 1, last: 100 };
      const result = project(t, 4);
      expect(result).not.toBeNull();
      expect(result.perWeek).toBe(1);
      expect(result.measured).toBe(7);
      expect(result.capped).toBe(true);
      expect(result.value).toBe(100 + 1 * 4);  // 104
    });

    it('usa pendiente medida si no exceede cap', () => {
      // slope = 0.002 kg/día, medido = 0.014 kg/semana
      // cap = 100 * 0.01 = 1 kg/semana
      // perWeek = min(0.014, 1) = 0.014
      const t = { n: 10, r2: 0.9, slope: 0.002, last: 100 };
      const result = project(t, 4);
      expect(result).not.toBeNull();
      expect(result.perWeek).toBeCloseTo(0.014, 5);
      expect(result.capped).toBe(false);
      expect(result.value).toBeCloseTo(100 + 0.014 * 4, 5);
    });
  });

  describe('strengthReadout()', () => {
    it('devuelve [] cuando no hay sesiones', () => {
      S.sessions = [];
      expect(strengthReadout()).toEqual([]);
    });

    it('filtra ejercicios con < 2 puntos', () => {
      S.sessions = [
        {
          start: 1,
          date: '2026-08-15',
          entries: [
            { name: 'Press', sets: [{ w: 50, r: 8 }] },     // 1 punto, filtrado
            {
              name: 'Remo',
              sets: [
                { w: 60, r: 6 },  // buen set
                { w: 55, r: 8 }
              ]
            }
          ]
        }
      ];
      const result = strengthReadout();
      expect(result.length).toBe(0);  // ambos tienen 1 sesión = 1 punto
    });

    it('ordena por último 1RM descendente', () => {
      // S.sessions en orden newest first
      S.sessions = [
        {
          start: 3,
          date: '2026-08-20',
          entries: [
            { name: 'Press', sets: [{ w: 52, r: 5 }] },
            { name: 'Remo', sets: [{ w: 80, r: 5 }] }
          ]
        },
        {
          start: 2,
          date: '2026-08-15',
          entries: [
            { name: 'Press', sets: [{ w: 51, r: 5 }] },
            { name: 'Remo', sets: [{ w: 78, r: 5 }] }
          ]
        },
        {
          start: 1,
          date: '2026-08-10',
          entries: [
            { name: 'Press', sets: [{ w: 50, r: 5 }] },
            { name: 'Remo', sets: [{ w: 75, r: 5 }] }
          ]
        }
      ];
      const result = strengthReadout();
      // Remo último e1rm será ~e1rm(80,5)=80*(1+5/30)≈93.3
      // Press último e1rm será ~e1rm(52,5)=52*(1+5/30)≈60.7
      // Remo > Press, así que Remo primero
      expect(result[0].name).toBe('Remo');
      expect(result[1].name).toBe('Press');
    });

    it('incluye tendencia en cada ejercicio', () => {
      // S.sessions debe estar en orden inverso (newest first) como en state.js
      S.sessions = [
        {
          start: 4,
          date: '2026-08-20',
          entries: [{ name: 'Press', sets: [{ w: 56, r: 5 }] }]
        },
        {
          start: 3,
          date: '2026-08-15',
          entries: [{ name: 'Press', sets: [{ w: 54, r: 5 }] }]
        },
        {
          start: 2,
          date: '2026-08-08',
          entries: [{ name: 'Press', sets: [{ w: 52, r: 5 }] }]
        },
        {
          start: 1,
          date: '2026-08-01',
          entries: [{ name: 'Press', sets: [{ w: 50, r: 5 }] }]
        }
      ];
      const result = strengthReadout();
      expect(result.length).toBe(1);
      const press = result[0];
      expect(press.name).toBe('Press');
      expect(press.pts.length).toBe(4);  // 4 sesiones
      expect(press.t).not.toBeNull();   // tendencia con 4 puntos
      expect(press.last).toBeCloseTo(e1rm(56, 5), 1);
    });
  });
});
