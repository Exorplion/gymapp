// 2026-10-08, Enzo: "me muestra femoral en anterior" y "el hombro tiene tres
// partes". El femoral entraba por el aductor y por "Extensión de cuádriceps"
// en singular, que caían sin porción y se contaban como cuádriceps Y femoral.
import { describe, it, expect } from 'vitest';
import { zonasDeEjercicio, zonasDeTurno, zonaDeForma, recuperacion, porRegion, REGIONES, ZONAS } from '../recuperacion.js';
import { CUERPOS } from '../bodydata.js';

// La rutina Anterior / Posterior de Enzo (templates.js + seed.js).
const ANTERIOR = ['Press plano máquina', 'Press inclinado', 'Pec deck unilateral', 'Press militar máquina', 'Elevaciones laterales',
  'Extensión de tríceps', 'Extensión de tríceps overhead', 'JM press unilateral', 'Extensión de cuádriceps', 'Hack squat',
  'Leg press', 'Leg extension', 'Aductor', 'Abdominales', 'Abs polea'];
const POSTERIOR = ['Jalón ancho', 'Kelso shrug', 'Pájaros', 'Remo neutro agarre cerrado', 'Remo espalda alta', 'Curl predicador',
  'Curl martillo', 'Peso muerto rumano', 'SLDL', 'Curl femoral', 'Hamstring curl', 'Elevación de gemelos', 'Hip thrust',
  'Back extension 45°', 'Abductor'];
const turno = nombres => ({ exercises: nombres.map(name => ({ name })) });

describe('Anterior ya no carga el femoral', () => {
  it('ningún ejercicio de Anterior va al femoral', () => {
    for (const n of ANTERIOR) expect(zonasDeEjercicio({ name: n }), n).not.toContain('Femoral');
  });
  it('las zonas de Anterior', () => {
    expect(zonasDeTurno(turno(ANTERIOR))).toEqual(['Pecho', 'Hombro anterior', 'Hombro lateral', 'Tríceps', 'Abs', 'Cuádriceps', 'Aductores']);
  });
  it('extensión de cuádriceps, en singular o plural, es cuádriceps', () => {
    for (const n of ['Extensión de cuádriceps', 'Extensiones de cuádriceps', 'Leg extension', 'Hack squat'])
      expect(zonasDeEjercicio({ name: n }), n).toEqual(['Cuádriceps']);
  });
  it('aductor a Aductores y abductor a Glúteo', () => {
    expect(zonasDeEjercicio({ name: 'Aductor' })).toEqual(['Aductores']);
    expect(zonasDeEjercicio({ name: 'Abductor' })).toEqual(['Glúteo']);
  });
  it('una pierna que no se reconoce sigue yendo a las dos (decir de más)', () => {
    expect(zonasDeEjercicio({ name: 'Pierna rara', cat: 'Pierna' })).toEqual(['Cuádriceps', 'Femoral']);
  });
});

describe('hombro en tres', () => {
  it('cada ejercicio a su porción', () => {
    expect(zonasDeEjercicio({ name: 'Press militar máquina' })).toEqual(['Hombro anterior']);
    expect(zonasDeEjercicio({ name: 'Elevaciones laterales' })).toEqual(['Hombro lateral']);
    expect(zonasDeEjercicio({ name: 'Elevación lateral con polea' })).toEqual(['Hombro lateral']);
    expect(zonasDeEjercicio({ name: 'Pájaros' })).toEqual(['Hombro posterior']);
    expect(zonasDeEjercicio({ name: 'Face pull' })).toEqual(['Hombro posterior']);
    expect(zonasDeEjercicio({ name: 'Aperturas posteriores' })).toEqual(['Hombro posterior']);
  });
  it('un hombro sin reconocer va a las tres', () => {
    expect(zonasDeEjercicio({ name: 'Cosa de hombro', cat: 'Hombro' })).toEqual(['Hombro anterior', 'Hombro lateral', 'Hombro posterior']);
  });
  it('los pájaros de Posterior no frenan el press militar de Anterior', () => {
    const H = 3600000, ahora = new Date('2026-10-08T18:00:00').getTime();
    const ses = (horas, name) => ({ date: '2026-10-0' + (horas > 30 ? 7 : 8), start: ahora - horas * H - H, end: ahora - horas * H,
      entries: [{ name, sets: Array.from({ length: 3 }, () => ({ w: 10, r: 12, t: ahora - horas * H })) }] });
    const r = recuperacion([ses(2, 'Pájaros'), ses(48, 'Press militar')], ahora);
    expect(r['Hombro posterior'].pct).toBeLessThan(10);
    expect(r['Hombro anterior'].pct).toBeGreaterThan(80);
  });
  it('Posterior trae trapecio y romboides (Kelso)', () => {
    expect(zonasDeEjercicio({ name: 'Kelso shrug' })).toEqual(['Trapecio', 'Romboides']);
    const zs = zonasDeTurno(turno(POSTERIOR));
    expect(zs).toContain('Trapecio');
    expect(zs).toContain('Romboides');
    expect(zs).toContain('Hombro posterior');
    expect(zs).not.toContain('Hombro anterior');
  });
});

describe('la lámina', () => {
  it('cada forma de hombro y pierna pinta una zona que existe', () => {
    for (const s of ['m', 'f']) for (const c of ['frente', 'espalda']) {
      for (const z of CUERPOS[s][c].zonas.filter(z => !z.parche && (z.cat === 'Hombro' || z.cat === 'Pierna'))) {
        expect(ZONAS, `${s} ${c} ${z.slug}`).toContain(zonaDeForma(z.cat, z.slug));
      }
    }
  });
  it('el frente tiene anterior y lateral; la espalda posterior y lateral', () => {
    for (const s of ['m', 'f']) {
      const subs = c => CUERPOS[s][c].zonas.filter(z => z.cat === 'Hombro').map(z => z.sub).sort();
      expect(subs('frente')).toEqual(['Deltoides anterior', 'Deltoides lateral']);
      expect(subs('espalda')).toEqual(['Deltoides lateral', 'Deltoides posterior']);
    }
  });
});

describe('regiones', () => {
  it('cada zona está en una sola región, en el orden de ZONAS', () => {
    expect(REGIONES.flatMap(r => r.zonas)).toEqual(ZONAS);
  });
  it('porRegion reparte y saca las vacías', () => {
    expect(porRegion(['Abs', 'Pecho', 'Cuádriceps'])).toEqual([
      { nombre: 'Pecho y hombros', zonas: ['Pecho'] },
      { nombre: 'Abdomen', zonas: ['Abs'] },
      { nombre: 'Piernas', zonas: ['Cuádriceps'] },
    ]);
  });
});
