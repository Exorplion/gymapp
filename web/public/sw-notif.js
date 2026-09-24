/* Notificaciones de FIERRO del lado del service worker: los toques, y el
 * push del recordatorio diario de peso.
 *
 * Va en un archivo aparte porque el service worker lo genera workbox
 * (generateSW), que no admite código propio adentro: se inyecta con
 * workbox.importScripts en vite.config.js.
 *
 * Sin esto, tocar la notificación de "sesión en curso" no hace absolutamente
 * nada — no es que abra mal, es que no hay nadie escuchando el evento.
 */

/* El push lo manda la GitHub Action de .github/workflows/recordatorio-peso.yml.
   Se muestra SIEMPRE: con userVisibleOnly (obligatorio en Chrome) un push que
   no termina en notificación le cuesta a la app un aviso genérico de "este
   sitio se actualizó en segundo plano" y, repetido, la baja del push. */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const titulo = d.title || 'FIERRO';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: d.body || '',
    tag: d.tag || 'fierro-push',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: d.url || './', accion: d.accion || null },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({
      type: 'window',
      // hace falta para ver las pestañas que todavía no controla este SW
      includeUncontrolled: true,
    });

    /* Si la app ya está abierta se le da el foco en vez de abrir otra: son
       datos locales en IndexedDB y dos pestañas sobre la misma sesión se
       pisarían. Enfocar también es lo que la persona espera — venía de ahí.
       Si la notificación trae una acción (abrir el registro de peso), se le
       avisa a la pestaña por mensaje: navegarla recargaría la app entera. */
    for (const c of clientes) {
      if (c.url.includes('/gymapp') || c.url.includes(self.registration.scope)) {
        if (data.accion) c.postMessage({ tipo: 'fierro-accion', accion: data.accion });
        if ('focus' in c) return c.focus();
      }
    }

    // No había ninguna abierta: se abre en la raíz del alcance del SW (o en
    // la URL de la acción, que la app lee al arrancar).
    if (self.clients.openWindow) return self.clients.openWindow(data.url || './');
    return undefined;
  })());
});
