// Gimnasios: dónde entrenás y con qué equipo hacés cada ejercicio AHÍ.
//
// El problema que resuelve: vas a un gym de findes que tiene otras máquinas
// —el mismo Lat Pulldown que en tu gym de siempre hacés con polea y barra, ahí
// es una máquina de placas—. Sin esto, cambiar de gym significaba editar el
// equipo del ejercicio a mano cada vez que volvías, y de paso mezclar en el
// historial dos cargas que no son comparables (ver equip.js: exKey ya separa
// por equipo/máquina, esto es la capa de arriba que dice CUÁL corresponde
// según dónde estás).
//
// Lo que NO hace: no traduce pesos entre equipos (equip.js ya explica por
// qué no se puede) y no arma un catálogo de gyms con fotos/mapa — eso es lo
// que ofrece TRACKED y no es el problema real que Enzo tiene; acá el gym es
// sólo una etiqueta con un mapa de "este ejercicio, en este lugar, con este
// equipo".
import { S, bump, saveCfg } from './state.js';
import { idb } from './db.js';
import { persistSlot } from './rutina-logic.js';

export const saveGyms = () => idb.put('settings', { key: 'gyms', value: S.gyms });

const keyOf = name => String(name || '').trim().toLowerCase();

export function createGym(name) {
  const n = name.trim();
  if (!n) return null;
  const gym = { id: crypto.randomUUID(), name: n, equip: {} };
  S.gyms.push(gym);
  saveGyms();
  bump();
  return gym;
}

export function renameGym(id, name) {
  const gym = S.gyms.find(g => g.id === id);
  if (!gym) return;
  const n = name.trim();
  if (n) gym.name = n;
  saveGyms();
  bump();
}

export function deleteGym(id) {
  S.gyms = S.gyms.filter(g => g.id !== id);
  if (S.cfg.activeGym === id) S.cfg.activeGym = null;
  saveGyms();
  saveCfg();
  bump();
}

/** Qué equipo usás para `exName` en el gym `gymId` — null si ese gym nunca
    tuvo una variante guardada para este ejercicio (cae al equipo que ya
    tenga el ejercicio en la rutina, sin más). */
export function gymEquipFor(gymId, exName) {
  const gym = S.gyms.find(g => g.id === gymId);
  return gym?.equip[keyOf(exName)] || null;
}

export function setGymEquip(gymId, exName, equip, machine) {
  const gym = S.gyms.find(g => g.id === gymId);
  if (!gym) return;
  const k = keyOf(exName);
  if (equip) gym.equip[k] = { equip, machine: machine || null };
  else delete gym.equip[k];
  saveGyms();
  bump();
}

/** Activa un gym y aplica su equipo guardado a los ejercicios del turno de
    HOY que tengan una variante configurada ahí — sólo esos, nunca reescribe
    de más: un ejercicio que ese gym no configuró se queda con el equipo que
    ya tenía. `persistSlot` (rutina-logic.js) es la misma función que ya usa
    el editor de rutina para guardar un turno, así que esto queda
    consistente con cualquier otro cambio de equipo hecho a mano. */
export async function setActiveGym(id) {
  S.cfg.activeGym = id;
  const gym = S.gyms.find(g => g.id === id);
  const idx = S.cfg.seqIndex;
  const slot = S.routine[idx];
  if (gym && slot?.exercises?.length) {
    let changed = false;
    for (const ex of slot.exercises) {
      const ov = gym.equip[keyOf(ex.name)];
      if (ov && (ex.equip !== ov.equip || ex.machine !== (ov.machine || undefined))) {
        ex.equip = ov.equip;
        ex.machine = ov.machine || undefined;
        changed = true;
      }
    }
    if (changed) await persistSlot(idx);
  }
  await saveCfg();
  bump();
}
