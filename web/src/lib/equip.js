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
