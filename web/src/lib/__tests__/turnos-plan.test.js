// El núcleo puro de los turnos universales: firma y plan de reconciliación.
import { describe, it, expect } from 'vitest';
import { claveNombre, firma, planReconciliacion, filasInconsistentes, claveTurno, claveDeSesion, snapshotDeFilas } from '../turnos.js';

const ex = (id, name, sets = 3, extra = {}) => ({ id, name, sets, reps: 10, ...extra });
const w = (id, order, name, exercises, extra = {}) => ({ id, order, type: 'workout', name, exercises, ...extra });
const r = (id, order) => ({ id, order, type: 'rest' });
const HOY = '2026-10-12';

// A · P · R · A · P · R · R, como la plantilla: cada copia con ids propios.
function semanaAP({ posteriorViernes } = {}) {
  return [
    w('s0', 0, 'Anterior', [ex('a1', 'Press plano', 4), ex('a2', 'Hack squat', 4)]),
    w('s1', 1, 'Posterior', [ex('p1', 'Curl femoral', 3), ex('p2', 'Remo', 4)]),
    r('s2', 2),
    w('s3', 3, 'Anterior', [ex('a3', 'Press plano', 4), ex('a4', 'Hack squat', 4)]),
    w('s4', 4, 'Posterior', posteriorViernes || [ex('p3', 'Curl femoral', 3), ex('p4', 'Remo', 4)]),
    r('s5', 5),
    r('s6', 6),
  ];
}

describe('claveNombre y firma', () => {
  it('claveNombre: sin tildes, minúsculas, sin espacios de más', () => {
    expect(claveNombre('  Posterior   B ')).toBe('posterior b');
    expect(claveNombre('Glúteo')).toBe('gluteo');
    expect(claveNombre(undefined)).toBe('');
  });

  it('la firma ignora los ids de ejercicio, el orden de las claves y los undefined', () => {
    const a = { name: 'P', exercises: [{ id: 'x', name: 'Remo', sets: 4, equip: undefined }] };
    const b = { exercises: [{ sets: 4, name: 'Remo', id: 'y' }], name: 'P' };
    expect(firma(a)).toBe(firma(b));
  });

  it('la firma cambia con el nombre, las series o el orden de los ejercicios', () => {
    const base = { name: 'P', exercises: [ex('1', 'Remo', 4), ex('2', 'Curl', 3)] };
    expect(firma({ ...base, name: 'Q' })).not.toBe(firma(base));
    expect(firma({ ...base, exercises: [ex('1', 'Remo', 3), ex('2', 'Curl', 3)] })).not.toBe(firma(base));
    expect(firma({ ...base, exercises: [ex('2', 'Curl', 3), ex('1', 'Remo', 4)] })).not.toBe(firma(base));
  });
});

describe('planReconciliacion — primera migración', () => {
  it('copias idénticas → un turno por nombre, sin versiones distintas', () => {
    const p = planReconciliacion({ filas: semanaAP(), guardados: undefined, hoy: HOY });
    expect(p.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior']);
    expect(p.distintas).toEqual([]);
    const [s0, s1, s2, s3, s4] = p.filas;
    expect(s0.turnoId).toBe(s3.turnoId);
    expect(s1.turnoId).toBe(s4.turnoId);
    expect(s0.turnoId).not.toBe(s1.turnoId);
    expect(s2).toEqual(r('s2', 2));
    // los ids de ejercicio del ganador (la primera)
    expect(p.turnos[1].exercises.map(e => e.id)).toEqual(['p1', 'p2']);
    // cada fila lleva la copia completa y la firma
    expect(s4.exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo']);
    expect(s4.turnoFirma).toBe(firma(p.turnos[1]));
  });

  it('copias distintas → gana la primera de la semana y se avisa', () => {
    const p = planReconciliacion({
      filas: semanaAP({ posteriorViernes: [ex('p3', 'Curl femoral', 2), ex('p4', 'Remo', 4), ex('p5', 'Hip thrust', 3)] }),
      hoy: HOY,
    });
    const post = p.turnos.find(t => t.name === 'Posterior');
    expect(post.exercises.map(e => [e.name, e.sets])).toEqual([['Curl femoral', 3], ['Remo', 4]]);
    expect(p.distintas).toEqual([{ nombre: 'Posterior', versiones: 2, gano: 'primera' }]);
  });

  it('los ids de slot, el orden y los descansos no cambian', () => {
    const filas = semanaAP();
    const p = planReconciliacion({ filas, hoy: HOY });
    expect(p.filas.map(f => [f.id, f.order, f.type])).toEqual(filas.map(f => [f.id, f.order, f.type]));
  });

  it('"Anterior A" y "Anterior B" siguen siendo dos turnos', () => {
    const filas = [
      w('s0', 0, 'Anterior A', [ex('1', 'Press')]),
      w('s1', 1, 'Anterior B', [ex('2', 'Press')]),
    ];
    const p = planReconciliacion({ filas, hoy: HOY });
    expect(p.turnos).toHaveLength(2);
    expect(p.filas[0].turnoId).not.toBe(p.filas[1].turnoId);
  });

  it('dos turnos sin nombre nunca se agrupan', () => {
    const filas = [w('s0', 0, '', []), w('s1', 1, '  ', [])];
    const p = planReconciliacion({ filas, hoy: HOY });
    expect(p.turnos).toHaveLength(2);
  });

  it('mayúsculas, tildes y espacios no separan un turno', () => {
    const filas = [w('s0', 0, 'Glúteo', [ex('1', 'Hip thrust')]), w('s1', 1, ' gluteo ', [ex('2', 'Hip thrust')])];
    const p = planReconciliacion({ filas, hoy: HOY });
    expect(p.turnos).toHaveLength(1);
    // el nombre distinto ya es una versión distinta: se respalda
    expect(p.distintas).toHaveLength(1);
  });
});

describe('planReconciliacion — después de migrar', () => {
  // Cada fila por separado, como vuelven de IndexedDB (un solo structuredClone
  // de todas conservaría los arrays compartidos entre filas).
  const migrado = () => planReconciliacion({ filas: semanaAP(), hoy: HOY });

  it('todo en orden → null (idempotente)', () => {
    const p = migrado();
    expect(planReconciliacion({ filas: p.filas, guardados: p.turnos, hoy: HOY })).toBeNull();
    expect(filasInconsistentes(p.filas, p.turnos).size).toBe(0);
  });

  it('una fila editada por una versión vieja gana aunque sea la segunda', () => {
    const p = migrado();
    const filas = p.filas.map(f => structuredClone(f));
    // la versión vieja edita el Posterior del viernes (slot 4) y deja la firma vieja
    filas[4].exercises[0].sets = 5;
    const p2 = planReconciliacion({ filas, guardados: p.turnos, hoy: HOY });
    const post = p2.turnos.find(t => t.name === 'Posterior');
    expect(post.id).toBe(p.filas[1].turnoId);   // conserva su id
    expect(post.exercises[0].sets).toBe(5);
    expect(p2.filas[1].exercises[0].sets).toBe(5);
    expect(p2.distintas).toEqual([{ nombre: 'Posterior', versiones: 2, gano: 'editada' }]);
    // y Anterior, que estaba en orden, no se toca
    expect(p2.turnos.find(t => t.name === 'Anterior')).toEqual(p.turnos.find(t => t.name === 'Anterior'));
  });

  it('una fila nueva sin turnoId con el nombre de un turno se suma a él, y gana el turno establecido', () => {
    const p = migrado();
    const filas = p.filas.map(f => structuredClone(f));
    filas[5] = w('nuevo', 5, 'posterior', [ex('z', 'Otra cosa')]);
    const p2 = planReconciliacion({ filas, guardados: p.turnos, hoy: HOY });
    expect(p2.filas[5].turnoId).toBe(p.filas[1].turnoId);
    expect(p2.turnos.find(t => t.id === p.filas[1].turnoId).exercises.map(e => e.name)).toEqual(['Curl femoral', 'Remo']);
    expect(p2.distintas).toHaveLength(1);
  });

  it('un turno guardado que ya no nombra ninguna fila se conserva', () => {
    const p = migrado();
    const huerfano = { id: 'viejo', name: 'Push', exercises: [ex('q', 'Press')], creado: '2026-01-01' };
    const filas = p.filas.map(f => structuredClone(f));
    filas[6] = w('s6', 6, 'Pull', [ex('k', 'Dominadas')]);   // fila nueva, dispara la reconciliación
    const p2 = planReconciliacion({ filas, guardados: [...p.turnos, huerfano], hoy: HOY });
    expect(p2.turnos.find(t => t.id === 'viejo')).toEqual(huerfano);
    expect(p2.turnos.map(t => t.name)).toEqual(['Anterior', 'Posterior', 'Push', 'Pull']);
  });

  it('filas sin turnos guardados (backup viejo importado) se unifican como la primera vez', () => {
    const p = migrado();
    const filas = p.filas.map(f => structuredClone(f)).map(({ turnoId: _a, turnoFirma: _b, ...f }) => f);
    const p2 = planReconciliacion({ filas, guardados: undefined, hoy: HOY });
    expect(p2.turnos).toHaveLength(2);
    expect(p2.distintas).toEqual([]);
  });
});

describe('claves de turno y de sesión', () => {
  const rutina = [{ id: 's1', turnoId: 'T' }, { id: 's4', turnoId: 'T' }, { id: 'x' }];
  it('claveTurno usa el turnoId o, sin turnos, el id del slot', () => {
    expect(claveTurno(rutina[0])).toBe('T');
    expect(claveTurno(rutina[2])).toBe('x');
    expect(claveTurno(null)).toBeNull();
  });
  it('claveDeSesion: la guardada, la de su slot, o su slotId', () => {
    expect(claveDeSesion({ turnoId: 'U', slotId: 's1' }, rutina)).toBe('U');
    expect(claveDeSesion({ slotId: 's4' }, rutina)).toBe('T');
    expect(claveDeSesion({ slotId: 'borrado' }, rutina)).toBe('borrado');
    expect(claveDeSesion({ weekday: 2 }, rutina)).toBeNull();
  });
  it('snapshotDeFilas deja afuera ids y fotos', () => {
    const snap = snapshotDeFilas([w('s0', 0, 'A', [ex('1', 'Press', 4, { photo: 'data:x', equip: 'barra' })]), r('s1', 1)]);
    expect(snap).toEqual([
      { type: 'workout', name: 'A', exercises: [{ name: 'Press', sets: 4, reps: 10, equip: 'barra', machine: undefined, illus: undefined, cat: undefined, unilateral: undefined }] },
      { type: 'rest' },
    ]);
  });
});
