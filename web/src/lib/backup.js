// Puerto de exportJSON()/importJSON(file)/wipeAll() (index.html, bloque
// "AJUSTES / respaldo").
//
// COMPATIBILIDAD: el formato sigue siendo {app:'fierro',version:N,...} y las
// claves de la v1 (routine/sessions/meals/foods/body/cfg) conservan su forma
// exacta, así que un backup de la app vanilla se restaura acá y un backup de
// acá se restaura allá (la vanilla ignora las claves que no conoce, y su
// chequeo es `!d.version`, que la v2 sigue pasando).
//
// POR QUÉ v2 — bug de PÉRDIDA DE DATOS corregido el 2026-09-05:
// STORES (db.js) son 7: routine, sessions, meals, foods, body, settings y
// gymPhotos. El importJSON v1 hacía `for (const st of STORES) idb.clear(st)`
// —los borraba los 7— y después restauraba SEIS claves. Pero dentro de
// 'settings' viven cuatro: cfg, draft, `lib` (rutinas guardadas) y `gyms`
// (gimnasios + mapa de equipo por ejercicio); y 'gymPhotos' es un store
// entero de fotos de máquina. Ninguno de esos tres se exportaba.
//
// Resultado: restaurar un backup BORRABA las rutinas guardadas, los gyms, el
// mapa de equipamiento y todas las fotos — una función de recuperación que
// destruía datos. Y como exKey() (equip.js) incluye el equipo, perder el mapa
// de gyms PARTE EN DOS el historial de cada ejercicio: lo que era "press en
// máquina Hammer" pasa a indexarse distinto, y lastDataFor()/entryDelta()/PRs
// dejan de encontrar el pasado. La pérdida era silenciosa y diferida.
//
// El arreglo tiene dos mitades, y las dos importan:
//   1. exportar TODO (lib, gyms y las fotos en base64), y
//   2. importar QUIRÚRGICAMENTE: no se borra un store por el que el archivo
//      no trae nada. Así, restaurar un backup viejo (v1, sin gyms ni fotos)
//      deja intactos los gyms y las fotos que ya tenías en el teléfono en vez
//      de barrerlos.
//
// Import unidireccional: sólo depende de state.js/format.js/db.js/toast.js.
import { S, saveCfg } from './state.js';
import { dstr } from './format.js';
import { idb, STORES } from './db.js';
import { toast } from './toast.js';

/** Los stores que un backup reemplaza por completo cuando los trae. NO
    incluye 'settings' (es mixto: cfg/draft/lib/gyms, y `draft` es la sesión
    en curso, que un backup no debería matar) ni 'gymPhotos' (se maneja
    aparte, sólo si el archivo trae fotos). */
const STORES_DATOS = ['routine', 'sessions', 'meals', 'foods', 'body'];

const blobADataURL = blob => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(blob);
});

export async function exportJSON() {
  try {
    // Las fotos son Blobs y JSON no los sabe serializar: van como data URL.
    // Se leen del store directamente (no de S) porque nunca se cargan en
    // memoria — getPhoto() las trae de a una, por diseño (gyms.js).
    const filas = await idb.all('gymPhotos');
    const photos = [];
    for (const row of filas) {
      if (!row?.blob) continue;
      photos.push({ id: row.id, ts: row.ts || null, data: await blobADataURL(row.blob) });
    }

    const data = {
      app: 'fierro', version: 2, exportedAt: new Date().toISOString(),
      routine: Object.values(S.routine), sessions: S.sessions, meals: S.meals,
      foods: S.foods, body: S.body, cfg: S.cfg,
      // v2: lo que la v1 perdía
      lib: S.lib, gyms: S.gyms, photos,
    };

    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fierro-backup-${dstr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    // Para poder decir después "último respaldo hace N días" sin inventarlo.
    S.cfg.lastBackupAt = Date.now();
    await saveCfg();

    const nF = photos.length;
    toast(`Backup descargado${nF ? ` · incluye ${nF} foto${nF > 1 ? 's' : ''}` : ''}`);
  } catch {
    // Nunca en silencio: si el respaldo no salió, el usuario TIENE que
    // enterarse — creer que respaldaste y no haberlo hecho es peor que el
    // error mismo.
    toast('⚠ No se pudo generar el backup');
  }
}

export async function importJSON(file) {
  let d;
  try {
    d = JSON.parse(await file.text());
    if (d.app !== 'fierro' || !d.version) throw new Error('formato');
  } catch {
    // Se valida ANTES de tocar nada: un archivo inválido no debe llegar a
    // borrar el primer store.
    toast('⚠ Archivo inválido');
    return;
  }

  try {
    // Sólo se vacía un store si el archivo trae esa colección. `undefined`
    // significa "este backup no sabe de esto", NO "esto está vacío" — mismo
    // criterio que el resto de la app: la ausencia de dato no es un cero.
    for (const st of STORES_DATOS) {
      if (!Array.isArray(d[st])) continue;
      await idb.clear(st);
      for (const r of d[st]) await idb.put(st, r);
    }

    // 'settings' se toca clave por clave, nunca con clear(): borrarlo entero
    // se llevaba puestos `lib` y `gyms` (el bug de la v1).
    if (d.cfg) await idb.put('settings', { key: 'cfg', value: d.cfg });
    if (Array.isArray(d.lib)) await idb.put('settings', { key: 'lib', value: d.lib });
    if (Array.isArray(d.gyms)) await idb.put('settings', { key: 'gyms', value: d.gyms });

    // Las fotos sólo se reemplazan si el backup trae la colección. Un backup
    // v1 (sin `photos`) deja las del teléfono donde están.
    if (Array.isArray(d.photos)) {
      await idb.clear('gymPhotos');
      for (const p of d.photos) {
        if (!p?.id || !p?.data) continue;
        const blob = await (await fetch(p.data)).blob();
        await idb.put('gymPhotos', { id: p.id, blob, ts: p.ts || Date.now() });
      }
    }

    const viejo = d.version < 2;
    toast(viejo ? 'Restaurado ✓ (backup v1: gyms y fotos se conservaron)' : 'Datos restaurados ✓');
    setTimeout(() => location.reload(), 900);
  } catch {
    // Distinto del "archivo inválido" de arriba a propósito: acá el archivo
    // era válido y la restauración se cortó a mitad, así que el estado puede
    // haber quedado parcial. Decirlo, no disfrazarlo de archivo malo.
    toast('⚠ La restauración falló a mitad — revisá tus datos');
  }
}

/** Ya confirmado por quien llama (ver Settings.jsx) — sólo ejecuta el borrado. */
export async function wipeAll() {
  for (const st of STORES) await idb.clear(st);
  location.reload();
}
