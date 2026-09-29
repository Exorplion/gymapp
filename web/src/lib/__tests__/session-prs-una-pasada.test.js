import { describe, it, expect, afterEach } from 'vitest';
import { S } from '../state.js';
import { sessionPRs } from '../session.js';
import { exKey } from '../equip.js';

/* G4 (auditoría total 2026-09): sessionPRs pasó a juntar el máximo previo de
   cada ejercicio en una sola pasada. Este test la compara contra la versión
   de antes (recorrer todo el historial por cada ejercicio) sobre un
   historial armado con variantes de equipo, máquina y unilateral. */
function prsDeAntes(sess) {
  const prior = S.sessions.filter(s => s.id !== sess.id && s.start < sess.start);
  const prs = [];
  (sess.entries || []).forEach(e => {
    if (!e.sets?.length) return;
    const bestSet = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]);
    let prevMax = 0;
    prior.forEach(s => (s.entries || []).forEach(pe => {
      if (exKey(pe) !== exKey(e)) return;
      pe.sets.forEach(st => { if (st.w > prevMax) prevMax = st.w; });
    }));
    if (bestSet.w > prevMax) prs.push({ name: e.name, equip: e.equip, machine: e.machine, unilateral: e.unilateral, w: bestSet.w, r: bestSet.r });
  });
  return prs;
}

// Generador determinista (sin Math.random: el test tiene que ser el mismo siempre).
function azar(semilla) { let x = semilla; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); }

describe('sessionPRs en una pasada', () => {
  afterEach(() => { S.sessions = []; });

  it('da lo mismo que la versión de antes para todas las sesiones', () => {
    const r = azar(7);
    const nombres = ['Press banca', 'Remo', 'Curl martillo', 'Leg press', 'Press militar'];
    const equipos = [undefined, 'barra', 'polea', 'discos'];
    S.sessions = Array.from({ length: 40 }, (_, i) => ({
      id: 's' + i,
      start: 1000 + i * 10 + (i % 3),
      entries: Array.from({ length: 1 + Math.floor(r() * 5) }, () => ({
        name: nombres[Math.floor(r() * nombres.length)],
        equip: equipos[Math.floor(r() * equipos.length)],
        machine: r() < 0.3 ? 'Máquina ' + Math.floor(r() * 2) : undefined,
        unilateral: r() < 0.2,
        sets: Array.from({ length: Math.floor(r() * 4) }, () => ({ w: Math.round(r() * 40) * 2.5, r: 5 + Math.floor(r() * 6) })),
      })),
    }));
    for (const s of S.sessions) expect(sessionPRs(s)).toEqual(prsDeAntes(s));
    // y una sesión que todavía no está en la lista
    const nueva = { id: 'x', start: 99999, entries: [{ name: 'Remo', sets: [{ w: 200, r: 5 }] }] };
    expect(sessionPRs(nueva)).toEqual(prsDeAntes(nueva));
  });
});
