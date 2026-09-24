// Recordatorio diario de peso, por Web Push.
//
// Por qué push y no una notificación programada: una PWA no puede agendar
// "avisame mañana a las 7:30" con la app cerrada. La API que lo permitía
// (Notification Triggers) Chrome la abandonó, y Periodic Background Sync
// corre cuando el navegador quiere, no a una hora. Lo único que despierta al
// teléfono a una hora fija es un push que llega de afuera.
//
// El "afuera" no es un servidor: es una GitHub Action con cron en el mismo
// repo (.github/workflows/recordatorio-peso.yml). Necesita dos secretos:
//   VAPID_PRIVATE_KEY  la mitad privada del par de abajo
//   PUSH_SUBSCRIPTION  el JSON que esta pantalla te deja copiar
// La app no tiene cómo mandarle la suscripción a GitHub sola (no hay
// backend), así que el paso de pegarla es a mano y una sola vez.
//
// La clave pública va en el código a propósito: es pública por diseño, y
// sólo sirve para que el navegador verifique que el push lo firmó quien
// tiene la privada.
import { S, saveCfg, bump } from './state.js';

export const VAPID_PUBLIC =
  'BEdM1fJEXexyz9H-gt3Gr7-QWkcEG_BYuJNe7fE5V11xdkTEl_DXhGgQq4F2B2sdaoUGNPVnAj-s7wxS3J90Muc';

/** ¿Este navegador puede recibir push? (iOS sólo con la app instalada.) */
export const soportaPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

/** base64url → Uint8Array, que es lo que pide applicationServerKey. */
export function claveABytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** La suscripción como la necesita la Action: sólo endpoint y claves. */
export function suscripcionParaCopiar(sub) {
  const j = typeof sub?.toJSON === 'function' ? sub.toJSON() : sub;
  if (!j?.endpoint || !j.keys?.p256dh || !j.keys?.auth) return null;
  return JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
}

/* `navigator.serviceWorker.ready` no se rechaza si no hay SW: se cuelga para
   siempre (ver notify.js). Acá se le pone techo para que el botón no quede
   girando sin fin en el servidor de desarrollo. */
function registro(ms = 4000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, no) => setTimeout(() => no(new Error('sin service worker')), ms)),
  ]);
}

/**
 * Estado real del recordatorio, sin suponer:
 *   'sin-soporte'  el navegador no hace push
 *   'bloqueado'    el permiso de notificaciones está denegado
 *   'apagado'      nunca se activó, o se apagó a propósito
 *   'activo'       hay suscripción y es la misma que se copió
 *   'desconectado' se había activado pero el navegador la perdió o la
 *                  cambió: el secreto de GitHub apunta a una que ya no existe
 */
export async function estadoRecordatorio() {
  if (!soportaPush()) return 'sin-soporte';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'bloqueado';
  const guardado = S.cfg.pesoPush?.endpoint;
  let sub = null;
  try { sub = await (await registro()).pushManager.getSubscription(); } catch { return guardado ? 'desconectado' : 'apagado'; }
  if (!guardado) return 'apagado';
  if (!sub || sub.endpoint !== guardado) return 'desconectado';
  return 'activo';
}

/** Activa (o re-activa) y devuelve el JSON para pegar en GitHub. Tiene que
    llamarse desde un toque: pedir permiso sin gesto lo bloquea Chrome. */
export async function activarRecordatorio() {
  if (!soportaPush()) throw new Error('Este navegador no recibe notificaciones push.');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Sin permiso de notificaciones no hay recordatorio.');
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveABytes(VAPID_PUBLIC),
    });
  }
  const json = suscripcionParaCopiar(sub);
  S.cfg.pesoPush = { endpoint: sub.endpoint, desde: Date.now() };
  saveCfg();
  bump();
  return json;
}

/** Apaga de verdad: da de baja la suscripción, así el próximo push ni llega
    (la Action lo ve como 410 y lo registra como aviso, no como error). */
export async function apagarRecordatorio() {
  try {
    const sub = await (await registro()).pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* sin SW no había nada suscripto */ }
  delete S.cfg.pesoPush;
  saveCfg();
  bump();
}

/** El JSON actual, para volver a copiarlo sin re-suscribir. */
export async function suscripcionActual() {
  try {
    const sub = await (await registro()).pushManager.getSubscription();
    return suscripcionParaCopiar(sub);
  } catch { return null; }
}
