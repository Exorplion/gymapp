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
// qué no se puede) y no arma un catálogo de gyms con mapa — eso es lo que
// ofrece TRACKED y no es el problema real que Enzo tiene; acá el gym es
// sólo una etiqueta con un mapa de "este ejercicio, en este lugar, con este
// equipo". La foto por máquina (más abajo) SÍ se agregó a pedido explícito
// —pero con un ángulo propio, no un catálogo social tipo TRACKED: es un
// campo más del mismo registro equip[exKey] que ya existía (una prueba
// visual de "esta es la variante de la que hablás", no una galería aparte
// para pasear) — se guarda como Blob nativo en su propio store
// ('gymPhotos', db.js) para no inflar el blob de 'settings'.
import { S, bump, saveCfg } from './state.js';
import { idb } from './db.js';
import { toast } from './toast.js';
import { persistSlot } from './rutina-logic.js';
import { shrinkImageBlob } from './photo.js';

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

/** Borra un gimnasio, con deshacer.

    Borraba en seco, y el botón vive pegado al de activar —que es el que más
    se toca de la fila—. Un error de dedo se llevaba el gym y, con él, todo
    el mapeo de "este ejercicio, acá, con esta máquina", que es trabajo de
    varias sesiones y no se puede reconstruir de memoria.

    Se resuelve con deshacer y no con un "¿estás seguro?" por dos razones:
    un diálogo de confirmación le cobra un paso a los borrados buenos, que
    son casi todos, y encima educa a tocar "sí" sin leer. Y porque la app ya
    tiene esta convención: rutina-logic.js avisa sus cambios destructivos con
    un toast de "Deshacer" (4 segundos, ver toast.js). Esto es lo mismo.

    Se guarda la posición además del objeto: al deshacer, el gym vuelve donde
    estaba y no al final: si reapareciera en otro lugar, uno dudaría de si se
    recuperó lo mismo que se borró. */
export function deleteGym(id) {
  const pos = S.gyms.findIndex(g => g.id === id);
  if (pos < 0) return;
  const borrado = S.gyms[pos];
  const eraActivo = S.cfg.activeGym === id;

  S.gyms = S.gyms.filter(g => g.id !== id);
  if (eraActivo) S.cfg.activeGym = null;
  saveGyms();
  saveCfg();
  bump();

  toast(`Se borró ${borrado.name}`, {
    actionLabel: 'Deshacer',
    onAction: () => {
      // splice con el índice acotado: si mientras tanto se borró algún otro,
      // la posición vieja puede quedar fuera de rango y splice lo agregaría
      // igual al final — acotar deja el resultado explícito en vez de casual.
      S.gyms.splice(Math.min(pos, S.gyms.length), 0, borrado);
      if (eraActivo) S.cfg.activeGym = id;
      saveGyms();
      saveCfg();
      bump();
    },
  });
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

const photoId = (gymId, exName) => `${gymId}::${keyOf(exName)}`;

/** Guarda/reemplaza la foto de "esta máquina, en este gym" — un campo más
    del registro equip[exKey], no una galería aparte (ver comentario de
    cabecera). `blob` es lo que entrega el <input type="file"> de la
    cámara/rollo, tal cual, sin recodificar. */
export async function savePhoto(gymId, exName, blob) {
  await idb.put('gymPhotos', { id: photoId(gymId, exName), blob, ts: Date.now() });
}

/** Devuelve el Blob guardado o null. El caller arma su propio object URL
    (URL.createObjectURL) y lo revoca al desmontar — acá no se cachea nada,
    para no pelear con la limpieza de esas URLs. */
export async function getPhoto(gymId, exName) {
  if (!gymId) return null;
  const row = await idb.get('gymPhotos', photoId(gymId, exName));
  return row?.blob || null;
}

export async function deletePhoto(gymId, exName) {
  await idb.del('gymPhotos', photoId(gymId, exName));
  S.fotoRev = (S.fotoRev || 0) + 1;
  bump();
}

/** Del <input type="file"> de la cámara a la foto guardada, con los mismos
    dos cuidados de siempre: comprimir ANTES de guardar (480px / JPEG 70 →
    ~50 KB en vez de varios MB) y avisar si falla, en vez de mostrar una foto
    que no quedó. Vive acá porque la sacan dos lugares: la tarjeta del
    ejercicio y la hoja de opciones.

    `S.fotoRev` sube con cada cambio: la miniatura de la tarjeta lo tiene en
    sus dependencias y se vuelve a leer sola. Devuelve si guardó. */
export async function guardarFotoMaquina(gymId, exName, file) {
  if (!gymId || !file) return false;
  let blob;
  try {
    blob = await shrinkImageBlob(file);
  } catch {
    toast('No se pudo leer esa imagen');
    return false;
  }
  try {
    await savePhoto(gymId, exName, blob);
  } catch {
    toast('No se pudo guardar la foto (¿sin espacio?)');
    return false;
  }
  S.fotoRev = (S.fotoRev || 0) + 1;
  bump();
  toast('Foto guardada');
  return true;
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
