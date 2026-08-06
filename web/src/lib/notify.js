// Notificaciones del sistema, con el service worker cuando lo hay.
//
// Chrome en Android sólo acepta notificaciones creadas desde el registro del
// service worker: `new Notification()` tira "Illegal constructor". Pero el SW
// no siempre está —en el servidor de desarrollo, en una pestaña recién abierta,
// o si el registro falló—, así que hace falta el camino de atrás.
//
// La trampa que esto resuelve: `navigator.serviceWorker.ready` NO se rechaza
// cuando no hay ninguno registrado. Se queda colgada para siempre. Comprobar
// `if (navigator.serviceWorker?.ready)` no sirve de nada, porque una promesa
// pendiente es igual de truthy que una resuelta — el código parecía tener un
// fallback y en realidad no se alcanzaba nunca, sin ningún error que lo
// delatara.
import { S } from './state.js';

/** Cuánto se espera al service worker antes de mandarla por el camino directo. */
const ESPERA_SW = 1200;

export const puedeNotificar = () => {
  try { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch { return false; }
};

/** Pide permiso una sola vez. El navegador sólo pregunta la primera vez;
    después devuelve la respuesta guardada.

    Hay que llamarla desde un gesto del usuario: Safari lo exige. */
export function pedirPermiso() {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') Notification.requestPermission();
  } catch { /* navegador sin soporte */ }
}

/** Corre `conRegistro` si el SW aparece a tiempo; si no, `directo`. */
function resolverSW(conRegistro, directo) {
  let resuelto = false;
  const cerrar = fn => { if (resuelto) return; resuelto = true; fn(); };
  try {
    const sw = navigator.serviceWorker?.ready;
    if (!sw) return cerrar(directo);
    setTimeout(() => cerrar(directo), ESPERA_SW);
    sw.then(r => cerrar(() => conRegistro(r))).catch(() => cerrar(directo));
  } catch { cerrar(directo); }
}

/** Muestra (o reemplaza, si comparte `tag`) una notificación. */
export function notificar(titulo, opts) {
  if (!puedeNotificar()) return;
  const full = { icon: './icon-192.png', badge: './icon-192.png', ...opts };
  resolverSW(
    r => r.showNotification(titulo, full).catch(() => {}),
    () => { try { new Notification(titulo, full); } catch { /* sólo vale por SW */ } },
  );
}

/** Cierra las que lleven ese `tag`. */
export function cerrarNotificacion(tag) {
  resolverSW(
    r => r.getNotifications({ tag }).then(ns => ns.forEach(n => n.close())).catch(() => {}),
    () => {},
  );
}

/** Silencio total: se usa al cerrar la app o al terminar la sesión. */
export const TAG_DESCANSO = 'fierro-descanso';
export const TAG_SESION = 'fierro-sesion';

/** ¿El usuario quiere notificaciones? Por defecto sí; se apaga en Ajustes. */
export const avisosActivos = () => S.cfg.avisos !== false;
