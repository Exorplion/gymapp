// Máquinas de un ejercicio, por gimnasio (Enzo, 2026-10-06): el mismo Close
// grip row se hace en la Low row machine o en la polea, y son dos historiales
// distintos. Cada máquina es una foto con el nombre que le pone él; elegirla
// cambia el nombre que se ve ("Close grip row en Polea") y con qué se compara.
//
// Vive en gym.maquinas[ejercicio] = [{ id, nombre, legado? }] y la última
// elegida en gym.ultimaMaquina[ejercicio]. El ejercicio de la rutina lleva la
// elegida del gym activo en `variante` (el id: entra en exKey, equip.js) y
// `varianteNombre` (lo que se lee) — mismo patrón que setActiveGym con el
// equipo: el gym decide, el ejercicio lo lleva puesto.
//
// La "Máquina 1" legada (`legado: true`) es la foto que ya existía antes de
// esto: no lleva `variante`, así conserva el historial de siempre.
//
// Acá sólo lo que no toca IndexedDB ni otros módulos (lo usa session.js sin
// ciclo de imports); crear, renombrar y borrar viven en gyms.js con las fotos.
import { S } from './state.js';

export const keyEj = name => String(name || '').trim().toLowerCase();

const gymDe = gymId => (gymId ? S.gyms?.find(g => g.id === gymId) || null : null);

/** Las máquinas de un ejercicio en un gym, en el orden en que se crearon. */
export function maquinasDe(gymId, exName) {
  return gymDe(gymId)?.maquinas?.[keyEj(exName)] || [];
}

/** La que usaste la última vez en ese gym, o null. */
export function maquinaElegida(gymId, exName) {
  const id = gymDe(gymId)?.ultimaMaquina?.[keyEj(exName)];
  return id ? maquinasDe(gymId, exName).find(m => m.id === id) || null : null;
}

/** Le pone al ejercicio la máquina elegida del gym (o se la saca si no hay).
    Devuelve si cambió algo, para que el que llama sepa si persistir. */
export function aplicarMaquina(ex, gymId = S.cfg?.activeGym) {
  if (!ex) return false;
  const m = maquinaElegida(gymId, ex.name);
  const variante = m && !m.legado ? m.id : undefined;
  const nombre = m ? m.nombre : undefined;
  if (ex.variante === variante && ex.varianteNombre === nombre) return false;
  if (variante) ex.variante = variante; else delete ex.variante;
  if (nombre) ex.varianteNombre = nombre; else delete ex.varianteNombre;
  return true;
}

/** "Close grip row en Polea", o el nombre solo si no hay máquina elegida. */
export const nombreConMaquina = ex => (ex?.varianteNombre ? `${ex.name} en ${ex.varianteNombre}` : (ex?.name || ''));
