// Puerto del timer de descanso (web/src/lib/rest.js). El estado vive en T
// (mutable, igual que S) y bump() avisa a React para repintar — mismo patrón
// que streak.js/session.js. Las escrituras directas a nodos DOM del original
// ($('#rest-fs'), $('#rfs-time'), $('#rest-fill'), etc.) se reemplazan por
// campos en T (T.leftSec, T.pct) que el componente <RestTimer/> lee en cada
// render en vez de que la función los escriba a mano.
//
// El final del descanso NO se decide contando ticks: se compara contra T.end,
// que es una marca de tiempo absoluta. Tanto el navegador (pestañas ocultas)
// como RN (apps en segundo plano) pueden frenar/retrasar los setInterval, así
// que contar ticks atrasaría la alarma justo cuando más importa — con el
// teléfono bloqueado. Comparando contra un instante fijo, que el tick llegue
// tarde sólo significa que la alarma suena apenas tarde, no que se pierda.
import { AppState } from 'react-native';
import { S, bump } from './state.js';
import { toast } from './toast.js';
import { prepararAlarma, pedirPermiso, sonar, callar, scheduleEndNotification, cancelScheduledNotification } from './alarm.js';

export const T = { end: 0, total: 0, int: null, state: 'hidden', leftSec: 0, pct: 0 };

export const REST_CIRC = 2 * Math.PI * 88;

/** Arranca el descanso.

    `segs` permite pedir una duración distinta a la configurada — la usa el
    calentamiento, que tiene su propia pausa de 2:45 antes de la primera serie.
    Sin argumento vale el ajuste de siempre. */
export function startRest(segs) {
  const total = segs > 0 ? segs : S.cfg.rest;
  if (!total) return;
  prepararAlarma();  // precargar el audio con el mismo gesto que arranca el descanso
  pedirPermiso();
  T.total = total; T.end = Date.now() + T.total * 1000;
  T.state = 'fullscreen';
  bump();
  scheduleEndNotification(T.total, 'Ya pasaron tus ' + T.total + ' segundos. A la próxima serie.');
  if (!T.int) T.int = setInterval(tickRest, 250);
  tickRest();
}

/** Suma o resta segundos al descanso en curso.

    Restar no puede dejar el final en el pasado: eso dispararía la alarma en el
    acto, que no es lo que pedís cuando tocás −30s con 10 segundos a favor. El
    piso son 5 segundos, suficiente para volver a tocar +30 si te pasaste. */
export function shiftRest(secs) {
  if (T.state !== 'fullscreen' && T.state !== 'minimized') return;
  const piso = Date.now() + 5000;
  T.end = Math.max(piso, T.end + secs * 1000);
  // el total sube con el tiempo agregado para que el anillo no se pase de vuelta
  T.total = Math.max(T.total, Math.ceil((T.end - Date.now()) / 1000));
  // el final se movió: la notificación programada para el horario viejo ya
  // no corresponde, hay que cancelarla y programar una nueva para el nuevo
  cancelScheduledNotification();
  scheduleEndNotification(Math.max(0, Math.round((T.end - Date.now()) / 1000)), 'Ya pasaron tus ' + T.total + ' segundos. A la próxima serie.');
  tickRest();
}

export function minimizeRest() {
  if (T.state !== 'fullscreen') return;
  T.state = 'minimized';
  bump();
}

export function expandRest() {
  if (T.state !== 'minimized') return;
  T.state = 'fullscreen';
  bump();
}

export function tickRest() {
  const left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
  const pct = Math.max(0, (T.end - Date.now()) / (T.total * 1000));
  T.leftSec = left;
  T.pct = pct;
  if (left <= 0 && T.state !== 'ringing') return terminar();
  bump();
}

/** Se acabó: para el reloj y arranca la alarma, que suena hasta que la cortan. */
function terminar() {
  clearInterval(T.int); T.int = null;
  T.leftSec = 0; T.pct = 0;
  T.state = 'ringing';
  bump();
  toast('⏱ ¡Descanso terminado!');
  // Si se calla sola por el tope, hay que sacar la pantalla de "sonando" o
  // quedaría pidiendo que pares algo que ya no suena.
  sonar('Ya pasaron tus ' + T.total + ' segundos. A la próxima serie.', () => {
    if (T.state === 'ringing') { T.state = 'hidden'; bump(); }
  });
}

export function stopRest() {
  clearInterval(T.int); T.int = null;
  callar();
  cancelScheduledNotification();
  T.state = 'hidden';
  bump();
}

/** Recupera el descanso al volver a la app.

    Los timers de JS pueden haberse congelado mientras la app estaba en
    segundo plano. Al volver, esto compara contra T.end y dispara la alarma
    si el descanso venció mientras no mirabas — sin esto la pantalla se
    quedaría en un número viejo, esperando un tick que nunca llegó. */
export function recuperarRest() {
  if (T.state === 'hidden' || T.state === 'ringing') return;
  if (Date.now() >= T.end) terminar();
  else tickRest();
}

// Equivalente RN de document.addEventListener('visibilitychange', ...) del
// original: no hay DOM ni pestañas acá, pero AppState.addEventListener
// dispara cuando la app vuelve a primer plano, que es el mismo momento en
// que hace falta recalcular contra T.end. Registrado una sola vez a nivel de
// módulo (como el original), vive todo el ciclo de vida de la app — no hace
// falta guardar/limpiar la suscripción.
// El resultado (una suscripción) no se guarda a propósito: vive todo el
// ciclo de vida de la app, así que no hace falta una variable para
// limpiarla más tarde.
AppState.addEventListener('change', nextState => {
  if (nextState === 'active') recuperarRest();
});
