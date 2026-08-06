// La notificación de "sesión en curso": mientras entrenás, en la barra del
// teléfono queda un aviso con el tiempo y por dónde vas.
//
// Para qué sirve: durante una sesión el teléfono está bloqueado casi todo el
// tiempo —estás levantando, no mirando la pantalla—. Sin esto, para saber
// cuánto llevás hay que desbloquear y abrir la app. Con esto lo ves de reojo
// desde la pantalla de bloqueo.
//
// Es silenciosa y sin vibración a propósito: la única que tiene derecho a hacer
// ruido es la alarma del descanso. Ésta sólo informa.
//
// Se refresca cada 30 segundos y no cada segundo: en la barra de notificaciones
// el minuto es la unidad que se lee, y repintarla a cada segundo gastaría
// batería para mostrar lo mismo.
//
// LÍMITE HONESTO: el texto lo escribe la app, así que se congela en el último
// valor si el navegador suspende la página. Va a decir "hace 12 min" cuando
// pasaron 15. Una notificación que se actualice sola con el teléfono dormido es
// una capacidad de app nativa que la web no tiene.

import { notificar, cerrarNotificacion, TAG_SESION as TAG } from './notify.js';

/** Cada cuánto se reescribe. El minuto es la unidad que se lee de reojo. */
const REFRESCO = 30000;

const O = { int: null, ultimo: '' };

/** "1 h 05 min" / "42 min" / "recién arrancaste" */
export function tiempoDeSesion(desde, ahora = Date.now()) {
  if (!desde) return 'recién arrancaste';
  const min = Math.floor((ahora - desde) / 60000);
  if (min < 1) return 'recién arrancaste';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
}

/** El renglón de abajo: dónde vas. */
export function resumenDeSesion({ hechos, total, series }) {
  const ej = `${hechos} de ${total} ejercicio${total === 1 ? '' : 's'}`;
  if (!series) return ej;
  return `${ej} · ${series} serie${series === 1 ? '' : 's'}`;
}

function pintar(titulo, cuerpo) {
  const clave = titulo + '|' + cuerpo;
  if (clave === O.ultimo) return;   // nada cambió: no la repintes
  O.ultimo = clave;
  notificar(titulo, {
    body: cuerpo,
    tag: TAG,
    renotify: false,     // no vuelve a avisar en cada refresco
    silent: true,        // la única que hace ruido es la alarma del descanso
    requireInteraction: true,
  });
}

/**
 * Enciende el aviso y lo mantiene al día.
 *
 * `datos()` se consulta en cada refresco en vez de recibir los valores una
 * sola vez: la sesión cambia mientras corre, y pasar una foto de cómo estaba al
 * arrancar dejaría el aviso mintiendo desde el primer ejercicio.
 */
export function mostrarSesion(datos) {
  const refrescar = () => {
    const d = datos();
    if (!d) return ocultarSesion();
    pintar(`Entrenando · ${tiempoDeSesion(d.start)}`, resumenDeSesion(d));
  };
  refrescar();
  if (!O.int) O.int = setInterval(refrescar, REFRESCO);
}

/** La apaga. Idempotente. */
export function ocultarSesion() {
  if (O.int) { clearInterval(O.int); O.int = null; }
  O.ultimo = '';
  cerrarNotificacion(TAG);
}
