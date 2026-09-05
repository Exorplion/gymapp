// Simetría izquierda/derecha en ejercicios unilaterales (Plan Fierro,
// candidato pendiente de Fases 1-3).
//
// Mismo criterio que lowMicros() en micronutrients.js: el aviso es un patrón
// sostenido en varias sesiones, no una serie sola mal registrada por cansancio
// o por agarrar la mancuerna equivocada un día. Sin datos de ambos lados en
// suficientes sesiones, la función devuelve null — nunca un 0 disfrazado de
// "estás simétrico".
import { S } from './state.js';
import { exKey } from './equip.js';

interface Side { left: number | null; right: number | null; }
interface SetEntry { side?: 'left' | 'right'; w: number; r?: number; }
interface SessionEntry { name?: string; equip?: string; machine?: string; sets: SetEntry[]; }
interface Session { entries?: SessionEntry[]; }

const MIN_SESSIONS = 3; // sesiones comparables mínimas para hablar de "patrón"
const IMBALANCE_PCT = 12; // umbral de aviso, dentro del rango 10-15% pedido

/** Peso máximo registrado por lado dentro de una sola entrada de sesión.
    null para el lado que no tiene ninguna serie ahí. */
function bestBySide(sets: SetEntry[] | undefined): Side {
  const bySide: Side = { left: null, right: null };
  for (const s of sets || []) {
    if (s.side !== 'left' && s.side !== 'right') continue;
    if (bySide[s.side] == null || s.w > (bySide[s.side] as number)) bySide[s.side] = s.w;
  }
  return bySide;
}

export interface Imbalance { pct: number; strongerSide: 'left' | 'right'; }

/** Desbalance izq/der sostenido para un ejercicio, mirando las sesiones más
    recientes donde AMBOS lados tienen datos (se ignoran las que no, en vez
    de contarlas como 0). Devuelve { pct, strongerSide } o null si no hay
    patrón sostenido — ni suficientes sesiones comparables, ni diferencia
    por encima del umbral. */
export function sideImbalance(ex: unknown): Imbalance | null {
  const key = exKey(ex);
  const diffs: number[] = [];
  const strongerCount = { left: 0, right: 0 };

  for (const s of (S.sessions as Session[])) {
    const entry = (s.entries || []).find(en => exKey(en) === key);
    if (!entry) continue;
    const { left, right } = bestBySide(entry.sets);
    if (left == null || right == null) continue; // sesión no comparable, se saltea
    const max = Math.max(left, right), min = Math.min(left, right);
    if (!max) continue;
    diffs.push((max - min) / max * 100);
    strongerCount[left > right ? 'left' : 'right']++;
    if (diffs.length >= MIN_SESSIONS) break; // sólo importan las más recientes
  }

  if (diffs.length < MIN_SESSIONS) return null;
  const avgPct = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (avgPct < IMBALANCE_PCT) return null;
  return {
    pct: Math.round(avgPct),
    strongerSide: strongerCount.left >= strongerCount.right ? 'left' : 'right',
  };
}
