/* Manejador de toques sobre las notificaciones de FIERRO.
 *
 * Va en un archivo aparte porque el service worker lo genera workbox
 * (generateSW), que no admite código propio adentro: se inyecta con
 * workbox.importScripts en vite.config.js.
 *
 * Sin esto, tocar la notificación de "sesión en curso" no hace absolutamente
 * nada — no es que abra mal, es que no hay nadie escuchando el evento.
 */

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({
      type: 'window',
      // hace falta para ver las pestañas que todavía no controla este SW
      includeUncontrolled: true,
    });

    /* Si la app ya está abierta se le da el foco en vez de abrir otra: son
       datos locales en IndexedDB y dos pestañas sobre la misma sesión se
       pisarían. Enfocar también es lo que la persona espera — venía de ahí. */
    for (const c of clientes) {
      if (c.url.includes('/gymapp') || c.url.includes(self.registration.scope)) {
        if ('focus' in c) return c.focus();
      }
    }

    // No había ninguna abierta: se abre en la raíz del alcance del SW, que es
    // donde vive la app.
    if (self.clients.openWindow) return self.clients.openWindow('./');
    return undefined;
  })());
});
