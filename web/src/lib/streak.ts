// La racha: cuántos días seguidos venís sin faltar.
//
// ---------------------------------------------------------------------------
// POR QUÉ SE REESCRIBIÓ (2026-09-10)
//
// La versión anterior no funcionaba, y no era una cuestión de definición sino
// un bug: `dayCompleted(dateStr)` recibía una fecha y **la ignoraba** — para
// decidir qué correspondía ese día leía siempre `S.routine[S.cfg.seqIndex]`,
// o sea el turno pendiente HOY. Consecuencias reales:
//
//   · si el turno pendiente era un descanso, devolvía null para TODOS los días
//     y la racha daba 0 con el mapa de calor entero pintado como "descanso";
//   · si era un entrenamiento, preguntaba "¿hay una sesión de ESTE turno ese
//     día?" para cada fecha del pasado, y eso es falso casi siempre, así que
//     la racha se cortaba al primer día hacia atrás.
//
// El comentario del archivo lo admitía como "aproximación". No lo era: no se
// puede reconstruir qué turno estaba pendiente en una fecha vieja, porque el
// puntero de la secuencia no guarda historia. Cualquier definición de racha
// apoyada en eso está condenada.
//
// ---------------------------------------------------------------------------
// LA DEFINICIÓN, Y POR QUÉ ES ÉSTA
//
// Enzo preguntó: "la racha debe ser por completar la rutina o parte de la
// rutina, debe haber una manera de mantenerla… creo que depende de los días y
// la rutina, ¿no?". Las dos mitades de esa intuición son correctas, y la
// definición sale de combinarlas con lo único que la app sabe con certeza de
// cada fecha: si entrenaste o no.
//
//   1. Un día con una sesión es un día entrenado. **Cuenta aunque sea parcial**
//      —dos ejercicios de cinco siguen siendo haber ido— y cuenta también si lo
//      anotaste a mano después (registrarDiaEntrenado). Eso es "completar la
//      rutina o parte de la rutina".
//
//   2. Un día sin sesión es descanso, y **el descanso no corta**. Es la
//      respuesta a "si un día no se entrenó automáticamente califica como
//      descanso": no hay que declarar nada, no entrenar ES descansar.
//
//   3. El descanso sólo corta cuando se estira más de lo que tu propia rutina
//      admite. Ahí entra "depende de la rutina": el límite no es un número
//      inventado, sale de cuántos descansos seguidos tiene TU secuencia. Si
//      alternás entreno y descanso, dos días seguidos sin ir ya es faltar; si
//      tu rutina tiene tres descansos juntos, tenés tres días.
//
// Lo que esto NO hace: no exige que hayas hecho el turno "que tocaba". La
// secuencia avanza al completar, no por fecha, así que "el turno que tocaba"
// para una fecha pasada no existe como dato — es justamente lo que rompía la
// versión anterior. Y castigar por hacer Posterior en vez de Anterior sería
// castigar por improvisar, que es lo que uno hace en un gimnasio real.
import { S } from './state.js';
import { dstr } from './format.js';

interface RoutineSlot { id: string; type: 'workout' | 'rest'; exercises?: unknown[] }
interface SessionEntry { date: string }

const routine = (): RoutineSlot[] => S.routine as RoutineSlot[];
const sessions = (): SessionEntry[] => S.sessions as SessionEntry[];

/** Tope duro por si la rutina fuera casi toda descanso: con más de una semana
    de tolerancia la racha dejaría de significar nada. */
const TOLERANCIA_MAX = 7;

/** Cuántos días seguidos sin entrenar admite tu rutina antes de que sea una
    falta.

    Sale de la tanda más larga de descansos de TU secuencia, más un día de
    respiro — correrse un día es normal y no debería costar la racha. La
    secuencia es circular (al terminar vuelve a empezar), así que la tanda se
    busca dando la vuelta: descansos al final y al principio son una sola.

    Sin rutina, o sin ningún descanso en ella, el mínimo es 1: podés saltarte
    un día. Cero sería exigir entrenar todos los días para siempre. */
export function toleranciaDescanso(): number {
  const r = routine();
  if (!r.length) return 1;
  const tipos = r.map(s => s.type);
  if (!tipos.includes('rest')) return 1;
  if (!tipos.includes('workout')) return TOLERANCIA_MAX;   // rutina 100% descanso
  let mejor = 0, actual = 0;
  // Dos vueltas para que una tanda que cruza el final se cuente entera.
  for (let i = 0; i < tipos.length * 2; i++) {
    if (tipos[i % tipos.length] === 'rest') { actual++; mejor = Math.max(mejor, actual); }
    else actual = 0;
  }
  return Math.min(TOLERANCIA_MAX, Math.min(mejor, tipos.length) + 1);
}

/** Las fechas en que hay al menos una sesión. */
function fechasEntrenadas(): Set<string> {
  return new Set(sessions().map(s => s.date));
}

/** ¿Entrenaste ese día? Sin vueltas: una sesión con esa fecha. */
export function dayTrained(dateStr: string): boolean {
  return fechasEntrenadas().has(dateStr);
}

const MAX_LOOKBACK = 3650; // ~10 años, cota dura del retroceso

/** Días seguidos sin faltar, contando desde hoy hacia atrás.

    Los días de descanso se cuentan **sólo cuando un día entrenado más viejo
    los respalda**: si hoy no entrenaste, hoy suma a la racha porque venís de
    una seguidilla, no porque no hacer nada sume por sí solo. Por eso los días
    sin sesión quedan "pendientes" hasta que aparece el entrenamiento que los
    sostiene, y si el hueco se pasa de la tolerancia no se cuentan nunca. */
export function currentStreak(): number {
  const fechas = fechasEntrenadas();
  if (!fechas.size) return 0;
  const primera = [...fechas].reduce((a, b) => (a < b ? a : b));
  const tol = toleranciaDescanso();
  let n = 0, pendientes = 0;
  const d = new Date();
  for (let i = 0; i < MAX_LOOKBACK; i++) {
    const ds = dstr(d);
    if (ds < primera) break;              // antes de tu primera sesión no hay racha que contar
    if (fechas.has(ds)) { n += pendientes + 1; pendientes = 0; }
    else {
      pendientes++;
      if (pendientes > tol) break;        // el hueco es una falta: la racha corta acá
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** La racha más larga que tuviste, con la misma regla. */
export function bestStreak(): number {
  const fechas = fechasEntrenadas();
  if (!fechas.size) return 0;
  const tol = toleranciaDescanso();
  const primera = [...fechas].reduce((a, b) => (a < b ? a : b));
  const hoy = dstr();
  let cur = 0, pendientes = 0, best = 0;
  const d = new Date(primera + 'T12:00:00');
  while (dstr(d) <= hoy) {
    const ds = dstr(d);
    if (fechas.has(ds)) {
      cur += pendientes + 1; pendientes = 0;
      best = Math.max(best, cur);
    } else {
      pendientes++;
      if (pendientes > tol) { cur = 0; pendientes = 0; }
    }
    d.setDate(d.getDate() + 1);
  }
  return best;
}

export interface StreakDay { date: string; status: 'rest' | 'done' | 'miss' }
export interface StreakHeatmap { days: StreakDay[]; pct: number }

/** Los últimos 56 días, cada uno como entrenado / descanso / falta.

    Un día sin sesión es **descanso** salvo que pertenezca a una tanda más
    larga que la tolerancia: recién ahí es una falta. Por eso la tanda se mide
    entera antes de etiquetar sus días — mirando un día suelto es imposible
    saber si fue descanso o abandono, y esa es justamente la diferencia que el
    mapa tiene que mostrar. */
export function streakHeatmap(): StreakHeatmap {
  const fechas = fechasEntrenadas();
  const tol = toleranciaDescanso();
  const dias: StreakDay[] = [];
  for (let i = 55; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dias.push({ date: dstr(d), status: 'rest' });
  }
  let i = 0;
  while (i < dias.length) {
    if (fechas.has(dias[i].date)) { dias[i].status = 'done'; i++; continue; }
    let j = i;
    while (j < dias.length && !fechas.has(dias[j].date)) j++;
    const largo = j - i;
    /* Vale lo mismo para una tanda cerrada que para la que llega hasta hoy:
       mientras no pase la tolerancia seguís a tiempo, y recién después es una
       falta. */
    if (largo > tol) for (let k = i; k < j; k++) dias[k].status = 'miss';
    i = j;
  }
  const contados = dias.filter(x => x.status !== 'rest').length;
  const hechos = dias.filter(x => x.status === 'done').length;
  return { days: dias, pct: contados ? Math.round((hechos / contados) * 100) : 0 };
}
