// Recomendar cómo cerrar la semana (turnos universales, Fase 4). El caso
// principal es el ejemplo trabajado de la spec (§6): A·P·R·A·P·R·R con la
// plantilla Anterior/Posterior; el martes "Pull con Juan" en vez de Posterior.
import { describe, it, expect } from 'vitest';
import { compensacion, avisoAlCerrar, faltasDelCiclo, TOPES } from '../compensacion.js';
import { recuperacion } from '../recuperacion.js';
import { TEMPLATES } from '../templates.js';

const sec = TEMPLATES.find(t => t.id === 'antpost').secuencia;
/** La semana de la plantilla, cada parada con su turno (como tras la Fase 1). */
const rutina = () => sec.map(([name, lista], i) => (lista
  ? {
    id: `s${i}`, order: i, type: 'workout', name, turnoId: name === 'Anterior' ? 'tA' : 'tP',
    exercises: lista.map(([n, sets, reps], k) => ({ id: `${name[0]}${k}`, name: n, sets, reps })),
  }
  : { id: `s${i}`, order: i, type: 'rest' }));

const DIA = { lun: '2026-10-12', mar: '2026-10-13', jue: '2026-10-15', vie: '2026-10-16' };
const t = (fecha, h) => new Date(`${fecha}T${String(h).padStart(2, '0')}:00:00`).getTime();
const series = (n, w = 40, hora) => Array.from({ length: n }, () => ({ w, r: 10, t: hora }));

/** Una sesión dentro del plan que hizo el turno entero (más `mas`). */
function sesionDelPlan(id, fecha, slot, mas = []) {
  const hora = t(fecha, 19);
  return {
    id, date: fecha, slotId: slot.id, turnoId: slot.turnoId, dayName: slot.name, start: hora - 3600000, end: hora,
    entries: [...slot.exercises, ...mas].map(e => ({ exId: e.id, name: e.name, sets: series(e.sets, 40, hora) })),
  };
}
/** El martes: "Pull con Juan", sesión libre en vez de Posterior. */
function pullConJuan(ciclo = 0) {
  const hora = t(DIA.mar, 19);
  return {
    id: 'pull', date: DIA.mar, slotId: null, libre: true, fueraDePlan: true, dayName: 'Pull con Juan',
    reemplaza: { slotId: 's1', turnoId: 'tP', nombre: 'Posterior', ciclo }, start: hora - 3600000, end: hora,
    entries: [
      { name: 'Dominadas', sets: series(4, 0, hora) }, { name: 'Remo con barra', sets: series(4, 60, hora) },
      { name: 'Face pull', sets: series(3, 20, hora) }, { name: 'Curl con barra', sets: series(4, 30, hora) },
    ],
  };
}

function jueves(extra = {}) {
  const routine = rutina();
  const sessions = [pullConJuan(), sesionDelPlan('lun', DIA.lun, routine[0])];
  return { routine, sessions, seqIndex: 3, ciclo: 0, fecha: DIA.jue, rec: recuperacion(sessions, t(DIA.jue, 10)), ...extra };
}
function viernes() {
  const routine = rutina();
  const gemelos = { id: 'cg', name: 'Elevación de gemelos', sets: 3 };
  const sessions = [sesionDelPlan('jue', DIA.jue, routine[3], [gemelos]), pullConJuan(), sesionDelPlan('lun', DIA.lun, routine[0])];
  return { routine, sessions, seqIndex: 4, ciclo: 0, fecha: DIA.vie, rec: recuperacion(sessions, t(DIA.vie, 10)) };
}

const nombresDeRutina = routine => new Set(routine.flatMap(s => (s.exercises || []).map(e => e.name)));
const nombreDe = (h, routine) => (h.tipo === 'traer' ? h.ex.name : routine[0].exercises.concat(routine[1].exercises).find(e => e.id === h.exId)?.name);

describe('lo que falta por la sesión fuera del plan', () => {
  it('la tabla de la spec: femoral 7, gemelos 4, glúteo 4, trapecio y romboides 3 (bíceps 2 no cuenta)', () => {
    const f = faltasDelCiclo(jueves());
    expect(f.faltas).toMatchObject({ Femoral: 7, Gemelos: 4, Glúteo: 4, Trapecio: 3, Romboides: 3 });
    expect([...f.perdida].sort()).toEqual(['Femoral', 'Gemelos', 'Glúteo', 'Romboides', 'Trapecio']);
  });
});

describe('el jueves (Anterior)', () => {
  const c = compensacion(jueves());
  it('trae Elevación de gemelos 3×15 de Posterior, y nada más', () => {
    expect(c.hoy).toEqual([expect.objectContaining({
      tipo: 'traer', zona: 'Gemelos', desde: 'Posterior', falta: 4,
      ex: expect.objectContaining({ name: 'Elevación de gemelos', sets: 3, reps: 15 }),
    })]);
  });
  it('femoral y glúteo no: el viernes los vuelve a cargar y no llegarían recuperados', () => {
    expect(c.hoy.some(h => ['Femoral', 'Glúteo'].includes(h.zona))).toBe(false);
    expect(c.despues).toEqual([{ zonas: ['Femoral', 'Glúteo', 'Trapecio', 'Romboides'], fecha: DIA.vie, turno: 'Posterior' }]);
    expect(c.sinLugar).toEqual([]);
  });
  it('dice de dónde viene y lo que falta', () => {
    expect(c.clave).toBe('0:s3');
    expect(c.origen).toEqual([{ sessionId: 'pull', fecha: DIA.mar, enVezDe: 'Posterior', hiciste: 'Pull con Juan' }]);
    expect(c.faltan[0]).toEqual({ zona: 'Femoral', series: 7, frecuencia: { plan: 2, real: 1 } });
  });
  it('con gemelos cargados ahora, no propone nada hoy', () => {
    const d = jueves();
    const c2 = compensacion({ ...d, rec: { ...d.rec, Gemelos: { pct: 30 } } });
    expect(c2.hoy).toEqual([]);
  });
});

describe('el viernes (Posterior), habiendo sumado los gemelos el jueves', () => {
  const c = compensacion(viernes());
  it('+2 Curl femoral y +2 Hip thrust: llega al tope de +4', () => {
    expect(c.hoy.map(h => [h.tipo, h.nombre, h.mas])).toEqual([['series', 'Curl femoral', 2], ['series', 'Hip thrust', 2]]);
    expect(c.hoy.reduce((a, h) => a + h.mas, 0)).toBe(TOPES.porSesion);
  });
  it('gemelos ya no falta (lo del jueves cuenta)', () => {
    expect(c.faltan.some(f => f.zona === 'Gemelos')).toBe(false);
  });
  it('lo que no entra se dice, y no pasa a la semana que viene', () => {
    expect(c.sinLugar).toEqual([{ zona: 'Femoral', series: 5 }, { zona: 'Trapecio', series: 3 }, { zona: 'Romboides', series: 3 }]);
    expect(c.despues).toEqual([]);
  });
});

describe('cuándo no dice nada', () => {
  it('sin sesiones fuera del plan', () => {
    const d = jueves();
    expect(compensacion({ ...d, sessions: d.sessions.filter(s => !s.fueraDePlan) })).toBe(null);
  });
  it('con el ciclo vencido (el puntero ya dio la vuelta)', () => {
    expect(compensacion({ ...jueves(), ciclo: 1 })).toBe(null);
  });
  it('fuera del plan en un descanso: no reemplazó nada', () => {
    const d = jueves();
    const s = { ...pullConJuan(), reemplaza: null };
    expect(compensacion({ ...d, sessions: [s, d.sessions[1]] })).toBe(null);
  });
  it('si hoy toca descanso', () => {
    expect(compensacion({ ...jueves(), seqIndex: 5 })).toBe(null);
  });
});

describe('las reglas', () => {
  it('nunca propone un ejercicio que no esté en tu rutina', () => {
    for (const d of [jueves(), viernes()]) {
      const c = compensacion(d);
      const nombres = nombresDeRutina(d.routine);
      for (const h of c.hoy) expect(nombres.has(nombreDe(h, d.routine))).toBe(true);
    }
  });
  it('no toca la rutina', () => {
    const d = viernes();
    const antes = JSON.stringify(d.routine);
    compensacion(d);
    expect(JSON.stringify(d.routine)).toBe(antes);
  });
  it('+2 por ejercicio como mucho, y un solo ejercicio traído', () => {
    for (const d of [jueves(), viernes()]) {
      const c = compensacion(d);
      c.hoy.filter(h => h.tipo === 'series').forEach(h => expect(h.mas).toBeLessThanOrEqual(TOPES.porEjercicio));
      expect(c.hoy.filter(h => h.tipo === 'traer').length).toBeLessThanOrEqual(TOPES.traidos);
    }
  });
});

describe('el aviso al cerrar la sesión fuera del plan', () => {
  it('el martes: compensa femoral, glúteo, gemelos… el jueves y el viernes', () => {
    const routine = rutina();
    const a = avisoAlCerrar({ routine, sessions: [pullConJuan()], seqIndex: 2, ciclo: 0, fecha: '2026-10-14' });
    expect(a.zonas).toEqual(['Femoral', 'Glúteo', 'Gemelos', 'Trapecio', 'Romboides']);
    expect(a.dias).toEqual([DIA.jue, DIA.vie]);
  });
  it('sin días de entrenamiento que queden en el ciclo, no avisa', () => {
    const routine = rutina();
    const s = { ...pullConJuan(), reemplaza: { slotId: 's4', turnoId: 'tP', nombre: 'Posterior', ciclo: 0 } };
    expect(avisoAlCerrar({ routine, sessions: [s], seqIndex: 5, ciclo: 0, fecha: '2026-10-17' })).toBe(null);
  });
});

describe('los textos', async () => {
  const { listaZonas, listaDias } = await import('../compensacion.js');
  it('zonas y días en castellano', () => {
    expect(listaZonas(['Femoral'])).toBe('femoral');
    expect(listaZonas(['Femoral', 'Glúteo', 'Gemelos'])).toBe('femoral, glúteo y gemelos');
    expect(listaZonas(['Femoral', 'Glúteo', 'Gemelos', 'Trapecio', 'Romboides'], 3)).toBe('femoral, glúteo, gemelos y 2 más');
    expect(listaDias([DIA.jue, DIA.vie])).toBe('El jueves y el viernes');
  });
});
