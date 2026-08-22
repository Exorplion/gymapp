// Puerto de web/src/lib/__tests__/muscle.test.js — conversión mecánica
// vi. -> jest. (Vitest -> Jest), imports globales de Jest (describe/it/
// expect no se importan explícitamente, igual que en state.test.js).
import { S } from './state.js';
import { catOf, muscleVolume, uncategorized, daysSinceGroup, daysSinceAll, stalestGroups, MUSCLE_CATS, groupStats, diasTexto, catsDeSesion } from './muscle.js';

// Los 18 ejercicios de la rutina real de Enzo que HOY no matchean: son el
// motivo de este bloque, así que son el test.
const REALES = [
  ['Press plano máquina', 'Pecho'],
  ['Press inclinado', 'Pecho'],
  ['Pec deck unilateral', 'Pecho'],
  ['Extensión tríceps unilateral', 'Tríceps'],
  ['JM press unilateral', 'Tríceps'],
  ['Leg press', 'Pierna'],
  ['Leg extension', 'Pierna'],
  ['Abs polea', 'Abs'],
  ['Jalón ancho', 'Espalda'],
  ['Remo espalda alta', 'Espalda'],
  ['Remo neutro', 'Espalda'],
  ['Curl predicador', 'Bíceps'],
  ['SLDL', 'Pierna'],
  ['Hamstring curl', 'Pierna'],
  ['Standing calf raise', 'Gemelos'],
  ['Back extension 45°', 'Espalda'],
  ['Aductor', 'Pierna'],
  ['Abductor', 'Pierna'],
];

describe('catOf', () => {
  it.each(REALES)('clasifica %s como %s', (nombre, esperado) => {
    expect(catOf(nombre)).toBe(esperado);
  });

  it('los que ya funcionaban siguen funcionando', () => {
    expect(catOf('Elevaciones laterales')).toBe('Hombro');
    expect(catOf('Press militar máquina')).toBe('Hombro');
    expect(catOf('Curl martillo')).toBe('Bíceps');
    expect(catOf('Hip thrust')).toBe('Glúteo');
  });

  it('el orden de la tabla importa: lo específico gana a lo genérico', () => {
    // "curl" solo es Bíceps, pero femoral/hamstring son Pierna
    expect(catOf('Curl femoral')).toBe('Pierna');
    expect(catOf('Curl con barra')).toBe('Bíceps');
    // "press" solo es Pecho, pero militar es Hombro y JM es Tríceps
    expect(catOf('Press militar')).toBe('Hombro');
    expect(catOf('Press banca')).toBe('Pecho');
  });

  it('un cat explícito gana sobre cualquier adivinanza', () => {
    expect(catOf({ name: 'Press banca', cat: 'Tríceps' })).toBe('Tríceps');
    expect(catOf({ name: 'Cosa rarísima', cat: 'Abs' })).toBe('Abs');
  });

  it('acepta objeto o string', () => {
    expect(catOf({ name: 'Jalón ancho' })).toBe('Espalda');
    expect(catOf('Jalón ancho')).toBe('Espalda');
  });

  it('lo que no reconoce devuelve null, no una categoría inventada', () => {
    expect(catOf('Zarandaja voladora')).toBe(null);
    expect(catOf('')).toBe(null);
    expect(catOf(null)).toBe(null);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(catOf('JALON ANCHO')).toBe('Espalda');
    expect(catOf('extension triceps')).toBe('Tríceps');
  });
});

describe('muscleVolume', () => {
  beforeEach(() => { S.sessions = []; });

  it('cuenta las series de los ejercicios que antes se descartaban', () => {
    S.sessions = [{
      id: 's1', date: new Date().toISOString().slice(0, 10), start: 1,
      entries: [
        { name: 'Jalón ancho', sets: [{ w: 80, r: 7 }, { w: 80, r: 6 }] },
        { name: 'Leg press', sets: [{ w: 180, r: 9 }] },
      ],
    }];
    const v = muscleVolume(7);
    expect(v.Espalda).toBe(2);
    expect(v.Pierna).toBe(1);
  });

  it('respeta el cat guardado en la entrada, no el de la rutina de hoy', () => {
    S.sessions = [{
      id: 's1', date: new Date().toISOString().slice(0, 10), start: 1,
      entries: [{ name: 'Press banca', cat: 'Hombro', sets: [{ w: 60, r: 8 }] }],
    }];
    expect(muscleVolume(7).Hombro).toBe(1);
    expect(muscleVolume(7).Pecho).toBeUndefined();
  });
});

describe('uncategorized', () => {
  it('lista los ejercicios de la rutina sin grupo, para poder avisarlo', () => {
    S.routine = {
      1: { weekday: 1, name: 'A', exercises: [
        { id: 'a', name: 'Jalón ancho' },
        { id: 'b', name: 'Zarandaja voladora' },
        { id: 'c', name: 'Otra cosa rara' },
      ] },
    };
    expect(uncategorized().map(e => e.name)).toEqual(['Zarandaja voladora', 'Otra cosa rara']);
  });

  it('con todo clasificado devuelve lista vacía', () => {
    S.routine = { 1: { weekday: 1, name: 'A', exercises: [{ id: 'a', name: 'Jalón ancho' }] } };
    expect(uncategorized()).toEqual([]);
  });
});

const sesion = (id, date, ejercicios) => ({
  id, date, start: Number(date.replace(/-/g, '')),
  entries: ejercicios.map(([name, sets]) => ({ name, sets })),
});
const serie = [{ w: 80, r: 7 }];

describe('daysSinceGroup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 10));   // 2026-08-10
    S.sessions = [];
  });
  afterEach(() => { jest.useRealTimers(); });

  it('cuenta los días desde la última sesión con ese grupo', () => {
    S.sessions = [sesion('a', '2026-08-08', [['Jalón ancho', serie]])];
    expect(daysSinceGroup('Espalda')).toBe(2);
  });

  it('un grupo entrenado hoy da 0', () => {
    S.sessions = [sesion('a', '2026-08-10', [['Jalón ancho', serie]])];
    expect(daysSinceGroup('Espalda')).toBe(0);
  });

  it('un grupo que nunca entrenaste da null, no un número grande', () => {
    S.sessions = [sesion('a', '2026-08-08', [['Jalón ancho', serie]])];
    expect(daysSinceGroup('Gemelos')).toBe(null);
  });

  it('toma la sesión MÁS RECIENTE de ese grupo, no la primera que encuentra', () => {
    S.sessions = [
      sesion('nueva', '2026-08-09', [['Jalón ancho', serie]]),
      sesion('vieja', '2026-07-01', [['Jalón ancho', serie]]),
    ];
    expect(daysSinceGroup('Espalda')).toBe(1);
  });

  it('una entrada sin series no cuenta como haber entrenado el grupo', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', []]])];
    expect(daysSinceGroup('Espalda')).toBe(null);
  });
});

describe('daysSinceAll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 10));
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', serie], ['Curl martillo', serie]])];
  });
  afterEach(() => { jest.useRealTimers(); });

  it('devuelve los nueve grupos, con null en los que no tienen historial', () => {
    const m = daysSinceAll();
    expect(Object.keys(m).sort()).toEqual([...MUSCLE_CATS].sort());
    expect(m.Espalda).toBe(1);
    expect(m['Bíceps']).toBe(1);
    expect(m.Pecho).toBe(null);
  });
});

describe('stalestGroups', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 10));
  });
  afterEach(() => { jest.useRealTimers(); });

  it('lista los que llevan 7 días o más, del más viejo al más nuevo', () => {
    S.sessions = [
      sesion('a', '2026-08-09', [['Curl martillo', serie]]),
      sesion('b', '2026-08-01', [['Jalón ancho', serie]]),
      sesion('c', '2026-07-20', [['Hip thrust', serie]]),
    ];
    expect(stalestGroups()).toEqual(['Glúteo', 'Espalda']);
  });

  it('los que nunca entrenaste NO aparecen: la app no le grita a un usuario nuevo', () => {
    S.sessions = [];
    expect(stalestGroups()).toEqual([]);
  });

  it('los frescos no aparecen', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', serie]])];
    expect(stalestGroups()).toEqual([]);
  });
});

describe('groupStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 10));   // 2026-08-10
    S.sessions = [];
  });
  afterEach(() => { jest.useRealTimers(); });

  const s2 = [{ w: 60, r: 10 }, { w: 70, r: 8 }];

  it('suma series, sesiones y volumen del grupo', () => {
    S.sessions = [
      sesion('a', '2026-08-09', [['Jalón ancho', s2], ['Curl con barra', serie]]),
      sesion('b', '2026-08-05', [['Remo neutro', serie]]),
    ];
    const g = groupStats('Espalda');
    expect(g.sets).toBe(3);
    expect(g.sesiones).toBe(2);
    expect(g.volumen).toBe(60 * 10 + 70 * 8 + 80 * 7);
  });

  it('ignora lo que cae fuera de la ventana', () => {
    S.sessions = [
      sesion('viejo', '2026-06-01', [['Jalón ancho', serie]]),
      sesion('nuevo', '2026-08-09', [['Jalón ancho', serie]]),
    ];
    expect(groupStats('Espalda').sets).toBe(1);
  });

  it('una sesión con dos ejercicios del grupo cuenta como UNA sesión', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', serie], ['Remo neutro', serie]])];
    const g = groupStats('Espalda');
    expect(g.sesiones).toBe(1);
    expect(g.sets).toBe(2);
  });

  it('las series sin repeticiones no cuentan', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', [{ w: 80, r: 0 }]]])];
    const g = groupStats('Espalda');
    expect(g.sets).toBe(0);
    expect(g.sesiones).toBe(0);
  });

  it('porSemana divide por las cuatro semanas de la ventana', () => {
    S.sessions = [
      sesion('a', '2026-08-09', [['Jalón ancho', serie]]),
      sesion('b', '2026-08-02', [['Jalón ancho', serie]]),
    ];
    expect(groupStats('Espalda').porSemana).toBe(0.5);
  });

  it('el tope es la serie más pesada, no la última', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', [{ w: 90, r: 5 }, { w: 50, r: 12 }]]])];
    expect(groupStats('Espalda').mejor).toMatchObject({ w: 90, r: 5, name: 'Jalón ancho' });
  });

  it('los ejercicios top van de más a menos series', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Remo neutro', serie], ['Jalón ancho', s2]])];
    expect(groupStats('Espalda').top).toEqual([
      { name: 'Jalón ancho', sets: 2 },
      { name: 'Remo neutro', sets: 1 },
    ]);
  });

  it('un grupo sin historial devuelve ceros y días null', () => {
    S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', serie]])];
    const g = groupStats('Gemelos');
    expect(g).toMatchObject({ sets: 0, sesiones: 0, volumen: 0, porSemana: 0, dias: null, mejor: null, top: [] });
  });

  describe('fibras (qué ejercicios hiciste, por fibra)', () => {
    it('agrupa por fibra cuando hay más de una — el jalón abajo, el remo arriba', () => {
      S.sessions = [sesion('a', '2026-08-09', [['Jalón ancho', s2], ['Remo neutro', serie]])];
      const g = groupStats('Espalda');
      expect(g.fibras).toEqual([
        { fibra: 'Dorsal bajo', sets: 2, ejercicios: [{ name: 'Jalón ancho', sets: 2 }] },
        { fibra: 'Dorsal alto', sets: 1, ejercicios: [{ name: 'Remo neutro', sets: 1 }] },
      ]);
    });

    // Glúteo no tiene sub-fibra: todo cae en la misma bolsa, así que mostrar
    // el desglose no agregaría nada sobre la lista plana de siempre.
    it('sin más de una fibra distinta, no arma el desglose', () => {
      S.sessions = [sesion('a', '2026-08-09', [['Hip thrust', serie], ['Patada de glúteo', s2]])];
      expect(groupStats('Glúteo').fibras).toBe(null);
    });

    it('un ejercicio sin fibra reconocida cae bajo el nombre del grupo entero, no un "otros" inventado', () => {
      // `cat` explícito y no el helper `sesion()`: fibrasDe() no reconoce
      // "Zarandaja voladora" por el nombre, así que hace falta un cat propio
      // en la entrada para que catOf() la cuente como Espalda de todos modos
      // (mismo patrón que el test de muscleVolume más arriba).
      S.sessions = [{
        id: 'a', date: '2026-08-09', start: 1,
        entries: [
          { name: 'Jalón ancho', sets: serie },                        // Dorsal bajo
          { name: 'Zarandaja voladora', cat: 'Espalda', sets: s2 },    // sin fibra -> "Espalda"
        ],
      }];
      const g = groupStats('Espalda');
      const bajo = g.fibras.find(f => f.fibra === 'Dorsal bajo');
      const generico = g.fibras.find(f => f.fibra === 'Espalda');
      expect(bajo.ejercicios).toEqual([{ name: 'Jalón ancho', sets: 1 }]);
      expect(generico.ejercicios).toEqual([{ name: 'Zarandaja voladora', sets: 2 }]);
    });

    it('las fibras van de más a menos series, y los ejercicios dentro de cada una también', () => {
      S.sessions = [sesion('a', '2026-08-09', [
        ['Curl predicador', serie],         // Bíceps braquial: 1
        ['Curl con barra', s2],             // Bíceps braquial: 2 (total 3)
        ['Curl martillo', [{ w: 20, r: 10 }, { w: 20, r: 10 }, { w: 20, r: 10 }]], // Braquiorradial: 3
      ])];
      const g = groupStats('Bíceps');
      expect(g.fibras.map(f => f.fibra)).toEqual(['Bíceps braquial', 'Braquiorradial']);
      expect(g.fibras[0].ejercicios.map(e => e.name)).toEqual(['Curl con barra', 'Curl predicador']);
    });

    // Bíceps braquial vs braquiorradial ahora sí distingue dentro de "Bíceps"
    // aunque la lámina no tenga un parche propio para cada uno (ver fibras.js).
    it('bíceps y tríceps también se desglosan aunque no tengan parche propio en la lámina', () => {
      S.sessions = [sesion('a', '2026-08-09', [['Curl predicador', serie], ['Curl martillo', s2]])];
      expect(groupStats('Bíceps').fibras).not.toBe(null);
    });
  });
});

describe('diasTexto', () => {
  it.each([[null, 'nunca'], [0, 'hoy'], [1, 'ayer'], [2, 'hace 2 días'], [12, 'hace 12 días']])(
    '%s → %s', (d, esperado) => { expect(diasTexto(d)).toBe(esperado); },
  );
});

describe('catsDeSesion', () => {
  it('devuelve los grupos únicos, en el orden de primera aparición', () => {
    const sess = {
      entries: [
        { name: 'Press banca', cat: 'Pecho', sets: [{ w: 60, r: 8 }] },
        { name: 'Sentadilla', cat: 'Pierna', sets: [{ w: 80, r: 8 }] },
        { name: 'Press inclinado', cat: 'Pecho', sets: [{ w: 40, r: 10 }] },
      ],
    };
    expect(catsDeSesion(sess)).toEqual(['Pecho', 'Pierna']);
  });

  it('sesión vacía no explota', () => {
    expect(catsDeSesion({ entries: [] })).toEqual([]);
  });

  it('sin sess (undefined/null) no explota', () => {
    expect(catsDeSesion(undefined)).toEqual([]);
    expect(catsDeSesion(null)).toEqual([]);
  });

  it('una entrada sin cat asignado se clasifica por nombre, como en cualquier otro lado', () => {
    const sess = { entries: [{ name: 'Press banca', sets: [{ w: 60, r: 8 }] }] };
    expect(catsDeSesion(sess)).toEqual(['Pecho']);
  });
});
