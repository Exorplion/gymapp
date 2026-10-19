// kg / lb por máquina y pesos traídos de otro gym (Enzo, 2026-10-18).
//
// En un mismo gym hay máquinas que marcan en kg y otras en lb, así que la
// unidad no es del gym ni de la sesión: es de la máquina. Vive en
// S.cfg.unidades["<gymId>|<exKey>"] (exKey ya lleva la máquina elegida,
// `@variante`). Los datos siguen guardándose SIEMPRE en kg; la unidad sólo
// decide qué ve la rueda y en qué escalón se mueve.
//
// El peso traído: la primera vez en una máquina, la rueda arranca en lo que
// hiciste la última vez en otra (otro gym, otra máquina) y la tarjeta lo dice
// tal cual — "En SmartFit hiciste 50 kg × 10". No se convierte con ningún
// factor (equip.js, relatedHistory: una polea no pesa lo que otra): es un
// punto de partida para probar, y la primera serie lo confirma o lo corrige.
//
// Sólo lee estado; lo que persiste (cambiarUnidad) vive en gyms.js.
import { S, wToUnit, wFromUnit } from './state.js';
import { exKey } from './equip.js';
import { round1, KG2LB } from './format.js';

export const unidadValida = u => (u === 'lb' ? 'lb' : 'kg');
export const claveUnidad = (gymId, ex) => `${gymId || '-'}|${exKey(ex)}`;

/** El escalón de la rueda en cada unidad: de a 2.5 kg o de a 5 lb. */
export const PASO = { kg: 2.5, lb: 5 };

const nombreEj = x => String(x?.name || '').trim().toLowerCase();

/** El gym al que pertenece una máquina (por el id de la variante). Las
    sesiones viejas no guardan el gym, pero la máquina sí lo dice. */
export function gymDeMaquina(varianteId) {
  if (!varianteId) return null;
  return (S.gyms || []).find(g => Object.values(g.maquinas || {}).some(l => (l || []).some(m => m.id === varianteId))) || null;
}

/** La última entrada del MISMO ejercicio en la misma máquina (exKey), o null. */
function ultimaPropia(ex, sessions) {
  const k = exKey(ex);
  for (const s of sessions || []) {
    const e = (s.entries || []).find(en => exKey(en) === k && en.sets?.length);
    if (e) return e;
  }
  return null;
}

/**
 * Lo que hiciste del mismo ejercicio en OTRA máquina u otro gym, para
 * arrancar ahí la primera vez en esta. null si esta máquina ya tiene
 * historial propio (ahí manda la progresión) o si nunca lo hiciste.
 *
 * Misma lateralidad o nada: un peso por lado no sirve de partida para uno
 * con las dos manos. Las sesiones vienen de la más nueva a la más vieja, así
 * que gana la más reciente.
 */
export function pesoTraido(ex, sessions = S.sessions) {
  const name = nombreEj(ex);
  if (!name || ultimaPropia(ex, sessions)) return null;
  const k = exKey(ex);
  const uni = !!ex.unilateral;
  for (const s of sessions || []) {
    for (const e of s.entries || []) {
      if (nombreEj(e) !== name || !e.sets?.length || exKey(e) === k || !!e.unilateral !== uni) continue;
      const mejor = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]);
      const gym = (e.gymId && (S.gyms || []).find(g => g.id === e.gymId)) || gymDeMaquina(e.variante);
      const otroGym = gym && gym.id !== S.cfg?.activeGym;
      return {
        kg: mejor.w,
        r: mejor.r,
        date: s.date,
        // "de SmartFit" si fue en otro gym; si no, la máquina ("de Low row").
        origen: otroGym ? gym.name : (e.varianteNombre || 'otra máquina'),
        enOtroGym: !!otroGym,
        // La unidad en la que lo hacías allá: si allá era kg, acá arranca en kg.
        unidad: e.unit || S.cfg?.unidades?.[claveUnidad(gym?.id, e)] || null,
      };
    }
  }
  return null;
}

/**
 * La unidad de la rueda para este ejercicio en este gym:
 *   1. la que elegiste para esta máquina (⇄ en la tarjeta);
 *   2. si la máquina ya tiene historial, la de la última vez;
 *   3. si es la primera vez y hay un peso traído, la de allá;
 *   4. la última que usaste en este gym; 5. la general.
 */
export function unidadDe(ex, gymId = S.cfg?.activeGym, sessions = S.sessions) {
  const elegida = S.cfg?.unidades?.[claveUnidad(gymId, ex)];
  if (elegida) return unidadValida(elegida);
  const propia = ultimaPropia(ex, sessions);
  if (propia?.unit) return unidadValida(propia.unit);
  if (!propia) {
    const t = pesoTraido(ex, sessions);
    if (t?.unidad) return unidadValida(t.unidad);
  }
  const gym = gymId ? (S.gyms || []).find(g => g.id === gymId) : null;
  return unidadValida(gym?.unit || S.cfg?.unit);
}

/** El peso (kg) llevado al escalón más cercano de la otra unidad: al pasar
    la rueda a lb, 50 kg queda en 110 lb, no en 110.2. */
export function alEscalon(kg, u) {
  const p = PASO[unidadValida(u)];
  return wFromUnit(Math.round(wToUnit(kg, u) / p) * p, u);
}

/* Los pesos se redondeaban SIEMPRE a 0.1 kg al guardarse (Enzo, 2026-10-19):
   115 lb son 52.163 kg, se guardaban como 52.2 y volvían como 115.1 lb. El
   redondeo va en la unidad que se ve; en kg queda exactamente como antes. */
export function pesoExacto(kg, u) {
  return unidadValida(u) === 'lb' ? round1(kg * KG2LB) / KG2LB : round1(kg);
}

/** ¿Es un número que esta unidad escribe tal cual? 115 lb guardado exacto sí;
    50 kg visto en lb (110.23) no. */
function exactoEn(kg, u) {
  const n = unidadValida(u) === 'lb' ? kg * KG2LB : kg;
  return Math.abs(n - round1(n)) < 0.01;
}

/**
 * El peso con el que arranca la rueda (y la meta que dice la tarjeta) en
 * esta máquina. Si viene de la otra unidad —la última vez fue en kg y esta
 * máquina marca lb— va al escalón de esta: 50 kg arranca en 110 lb, no en
 * 110.2, que la máquina no tiene. Si ya es un número de esta unidad (112 lb
 * puestos a mano) no se toca.
 */
export function enLaMaquina(kg, u) {
  if (kg == null) return kg;
  return exactoEn(kg, u) ? kg : alEscalon(kg, u);
}

/** La unidad en la que se hizo una entrada del historial. Se guarda desde el
    2026-10-18; antes la única que existía era la general. No se adivina con
    la que hoy tiene la máquina: eso sería decir "lo hiciste en lb" sin saberlo. */
export function unidadDeEntrada(e) {
  return unidadValida(e?.unit || S.cfg?.unit);
}

/** La unidad de la última vez en esta máquina: "Sesión anterior" se dice
    como se hizo (50 kg), no convertida a la de hoy (110.2 lb). */
export function unidadUltima(ex, sessions = S.sessions) {
  const e = ultimaPropia(ex, sessions);
  return e ? unidadDeEntrada(e) : unidadDe(ex);
}

/**
 * Corrige, una vez, las series en lb que se guardaron con el redondeo viejo
 * (52.2 kg por 115 lb): las lleva a la media libra más cercana. Devuelve
 * cuántas cambió.
 *
 * Sólo toca lo que sin duda fue eso: una entrada en lb, un peso que no es un
 * escalón de kg (múltiplo de 2.5: ésa es una serie hecha en kg antes de
 * cambiar la unidad) y que queda a menos de 0.12 lb de una media libra —
 * el redondeo a 0.1 kg mueve como mucho 0.11 lb. Ya exacto, no cambia: se
 * puede correr en cada arranque.
 */
export function corregirSeriesLb(entries) {
  let n = 0;
  for (const e of entries || []) {
    if (unidadValida(e?.unit) !== 'lb') continue;
    for (const s of e.sets || []) {
      if (!(s.w > 0) || Math.abs(s.w / 2.5 - Math.round(s.w / 2.5)) < 1e-6) continue;
      const lb = s.w * KG2LB;
      const media = Math.round(lb * 2) / 2;
      const dist = Math.abs(lb - media);
      if (dist < 1e-6 || dist > 0.12) continue;
      s.w = media / KG2LB;
      n++;
    }
  }
  return n;
}
