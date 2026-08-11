// Sistema de equipamiento por ejercicio.
//
// El problema que resuelve: hasta ahora todo el historial (última vez, PRs,
// progresión) comparaba SÓLO por nombre de ejercicio. Pero "Press de pecho a
// 60 kg" no significa lo mismo en una máquina de discos, en una de placas con
// polea, o con barra libre — cada sistema mueve una carga efectiva distinta
// para el mismo esfuerzo:
//
//   · barra/mancuernas: el número ES el peso, comparable entre gimnasios;
//   · discos (tipo Hammer): además del disco cargás el brazo de la máquina,
//     que pesa distinto en cada modelo;
//   · placas/polea: el número del stack es una etiqueta del fabricante, y las
//     poleas reducen la carga efectiva según cuántas tenga;
//   · Smith: la barra va contrapesada, así que pesa menos de lo que dice.
//
// Por eso el historial se compara ahora por nombre + equipo, y opcionalmente
// por máquina concreta (ver machineKey más abajo).
export const EQUIP = [
  { id: 'barra',      label: 'Barra',        hint: 'El número es el peso real. Comparable en cualquier gimnasio.' },
  { id: 'mancuernas', label: 'Mancuernas',   hint: 'Peso por mano. Comparable en cualquier gimnasio.' },
  { id: 'discos',     label: 'Discos',       hint: 'Cargás discos sobre un brazo que ya pesa. No comparable entre modelos.' },
  { id: 'placas',     label: 'Placas',       hint: 'Stack numerado del fabricante. No comparable entre máquinas.' },
  { id: 'polea',      label: 'Polea',        hint: 'Las poleas reducen la carga efectiva. No comparable entre máquinas.' },
  { id: 'smith',      label: 'Smith',        hint: 'La barra va contrapesada: pesa menos de lo que marca.' },
  { id: 'corporal',   label: 'Peso corporal', hint: 'Sin carga externa, o con lastre.' },
];

export const EQUIP_LABEL = Object.fromEntries(EQUIP.map(e => [e.id, e.label]));
export const EQUIP_HINT = Object.fromEntries(EQUIP.map(e => [e.id, e.hint]));

/** Para polea, "qué máquina" pedía una marca que casi nadie sabe de memoria —
    entrenás en el mismo gimnasio de siempre y lo que en verdad distingue una
    polea de otra no es el fabricante, es cuánto pesa realmente tirar de ella
    (cuántas poleas tiene el sistema, si hay contrapeso). Estas opciones piden
    justo eso, y sirven para el mismo campo `machine` que ya existía — no es
    un campo nuevo, es una forma más fácil de llenar el mismo. */
export const POLEA_FEEL = [
  { id: 'se siente liviana', label: 'Se siente liviana' },
  { id: 'normal', label: 'Normal' },
  { id: 'se siente pesada', label: 'Se siente pesada' },
];

/** Equipos cuyo número NO es comparable fuera de esa máquina concreta. */
const MACHINE_BOUND = new Set(['discos', 'placas', 'polea']);
export const isMachineBound = equip => MACHINE_BOUND.has(equip);

/**
 * Clave con la que se compara un ejercicio contra su propio historial.
 *
 * Sin equipo declarado cae al nombre solo — así las rutinas que ya existen
 * siguen funcionando exactamente igual que antes, sin migración de datos.
 * En cuanto asignás equipo, el ejercicio deja de mezclarse con registros de
 * otro sistema de carga.
 *
 * Para discos/placas/polea se agrega además la máquina, porque en esos
 * sistemas dos máquinas distintas del mismo tipo tampoco son comparables.
 */
export function exKey(ex) {
  const name = String(ex?.name || '').trim().toLowerCase();
  if (!ex?.equip) return name;
  const machine = isMachineBound(ex.equip) && ex.machine
    ? `·${String(ex.machine).trim().toLowerCase()}`
    : '';
  return `${name}·${ex.equip}${machine}`;
}

/** Etiqueta corta para mostrar junto al ejercicio: "Placas · Life Fitness". */
export function equipLabel(ex) {
  if (!ex?.equip) return '';
  const base = EQUIP_LABEL[ex.equip] || ex.equip;
  return ex.machine ? `${base} · ${ex.machine}` : base;
}

/**
 * Qué sabemos del MISMO ejercicio hecho con OTRO equipo.
 *
 * Sirve para la primera vez que usás una máquina: no para traducir el número
 * (no se puede — es justo lo que este módulo separa), sino para mostrarte de
 * dónde venís y que calibres a partir de ahí.
 *
 * Deliberadamente NO devuelve un peso sugerido. Aplicar un factor de
 * conversión entre sistemas de carga daría un número con aire de precisión que
 * no tiene: depende del modelo de máquina, de cuántas poleas lleve y del
 * contrapeso, datos que la app no tiene. Un número inventado es peor que
 * ninguno, porque se le cree.
 */
export function relatedHistory(ex, sessions) {
  const name = String(ex?.name || '').trim().toLowerCase();
  if (!name) return [];
  const selfKey = exKey(ex);
  const seen = new Map();
  for (const s of sessions || []) {
    for (const e of s.entries || []) {
      if (String(e.name || '').trim().toLowerCase() !== name) continue;
      if (exKey(e) === selfKey) continue;        // eso ya es su propio historial
      if (!e.sets?.length) continue;
      const k = exKey(e);
      if (seen.has(k)) continue;                  // sólo la vez más reciente de cada variante
      const best = e.sets.reduce((a, b) => (b.w > a.w ? b : a), e.sets[0]);
      seen.set(k, { label: equipLabel(e) || 'sin equipo', w: best.w, r: best.r, date: s.date });
    }
  }
  return [...seen.values()];
}
