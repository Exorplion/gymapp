/* Por qué existe este módulo — 2026-09-17, pérdida total de datos.
 *
 * Enzo entrenó el martes 15 y el jueves 17 abrió la app sin rutina, sin
 * sesiones y sin pesos: TODO, de una sola vez. No fue la app. Los tres
 * caminos que borran (wipeAll en backup.js, los idb.clear de rutina-logic.js
 * y la migración de db.js) están detrás de una confirmación explícita, y el
 * esquema no cambió en el deploy de ese martes.
 *
 * Fue el navegador. Sin `navigator.storage.persist()`, Chrome clasifica el
 * almacenamiento del origen como *best-effort*: cuando el teléfono se queda
 * corto de espacio, el sistema desaloja el origen ENTERO —IndexedDB,
 * localStorage y caches juntos— sin preguntar y sin dejar rastro. Es
 * exactamente la forma que tuvo la pérdida: nada tocado, todo ausente.
 *
 * `persist()` sube el almacenamiento a *persistent*, que el navegador ya no
 * desaloja automáticamente: sólo lo borra el usuario a mano. Chrome lo
 * concede sin preguntar si la PWA está instalada o si el sitio tiene
 * engagement suficiente; si no, lo DENIEGA en silencio. Por eso esto no
 * alcanza solo y devolvemos el estado real para poder decirlo: la única
 * copia que sobrevive a un borrado del usuario sigue siendo el backup
 * exportado, que vive en Descargas, fuera del bucket desalojable.
 */

/** Estado de persistencia del origen.
 *  `null` = no se pudo saber (API ausente, contexto inseguro, o la llamada
 *  falló). Deliberadamente distinto de `false` ("se preguntó y el navegador
 *  dijo que no"): la app no afirma sobre lo que no midió. */
export async function ensurePersisted() {
  if (!navigator.storage?.persist || !navigator.storage?.persisted) return null;
  try {
    // Preguntar primero: `persist()` es idempotente, pero si ya está
    // concedido no hace falta y en algunos navegadores vuelve a evaluar
    // heurísticas de engagement.
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Espacio usado/disponible por el origen, en bytes. `null` cuando el
 *  navegador no lo expone — no se rellena con ceros, que se leerían como
 *  "no estás usando nada" y es justo lo contrario de lo que pasó. */
export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number') return null;
    return { usage, quota };
  } catch {
    return null;
  }
}

/** Días enteros desde el último respaldo exportado.
 *  `null` = nunca respaldó. Mismo criterio que `daysSinceGroup()`: "nunca"
 *  no es "hace mucho", y sobre todo no es 0. */
export function daysSinceBackup(lastBackupAt, now = Date.now()) {
  if (!lastBackupAt) return null;
  return Math.floor((now - lastBackupAt) / 86400000);
}

/* Umbral del aviso. 21 días y no 1: los avisos de esta app son raros o la
   moneda se devalúa. Con un mes de historial en juego, tres semanas es el
   punto donde perder la data ya duele de verdad. */
export const DIAS_AVISO_BACKUP = 21;

/** ¿Hay que avisarle que respalde? Sólo si hay algo que perder.
 *  Sin sesiones no se avisa nada: molestar a alguien que todavía no anotó
 *  nada es ruido puro. */
export function necesitaBackup(nSesiones, lastBackupAt, now = Date.now()) {
  if (!nSesiones) return false;
  const d = daysSinceBackup(lastBackupAt, now);
  return d === null || d >= DIAS_AVISO_BACKUP;
}
