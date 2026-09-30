// Qué archivos de assets/ conservar al publicar. Lo usa publish-root.mjs.
//
// Antes publish-root borraba assets/ entero en cada publicación. Pero una
// pantalla que quedó abierta desde antes sigue corriendo el JS viejo, y ese JS
// pide sus módulos por el nombre con hash de SU build (PrBurst-XXXX.js, el
// worker del anillo). El service worker nuevo toma el control al instante y
// limpia su caché vieja (skipWaiting + clientsClaim + cleanupOutdatedCaches),
// así que el pedido va a la red — y si el archivo ya no está en el servidor,
// "Failed to fetch dynamically imported module" y la pantalla se cae. Pasó el
// 2026-09-29 al cerrar una sesión con récord, con varias publicaciones el
// mismo día.
//
// Por eso se conservan los archivos de las últimas CONSERVAR publicaciones: una
// pestaña vieja todavía encuentra lo que pide, y assets/ no crece sin límite.

export const CONSERVAR = 5;

/**
 * @param {unknown} historial  lo leído de assets/.publicaciones.json: una lista
 *   de publicaciones, cada una la lista de archivos de assets/ que usó. null o
 *   algo que no sea una lista = no hay historial (primera vez con este script).
 * @param {string[]} nuevos    los archivos de assets/ del build que se publica.
 * @param {string[]} presentes los archivos que hay hoy en assets/ (antes de copiar).
 * @returns {{ historial: string[][], borrar: string[] }}
 */
export function podar(historial, nuevos, presentes) {
  let previo = Array.isArray(historial) && historial.every(Array.isArray) ? historial : null;
  // Sin historial, lo que ya está publicado cuenta como la publicación anterior:
  // es justo lo que una pestaña abierta puede estar pidiendo ahora.
  if (!previo) previo = presentes.length ? [presentes.slice()] : [];
  const siguiente = [...previo, nuevos.slice()].slice(-CONSERVAR);
  const vivos = new Set(siguiente.flat());
  // Candidatos: lo que hay en disco y lo que figuraba en publicaciones que
  // ahora salen del historial (borrar algo que ya no está no hace daño).
  const candidatos = [...new Set([...presentes, ...previo.flat()])];
  const borrar = candidatos.filter(f => !vivos.has(f));
  return { historial: siguiente, borrar };
}
