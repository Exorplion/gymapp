// Puerto del timer de descanso (index.html: "timer descanso"). El estado
// vive en T (mutable, igual que S) y bump() avisa a React para repintar —
// mismo patrón que streak.js/session.js. Las escrituras directas a nodos DOM
// del original ($('#rest-fs'), $('#rfs-time'), $('#rest-fill'), etc.) se
// reemplazan por campos en T (T.leftSec, T.pct) que el componente
// <RestTimer/> lee en cada render en vez de que la función los escriba a mano.
//
// El final del descanso NO se decide contando ticks: se compara contra T.end,
// que es una marca de tiempo absoluta. El navegador frena los setInterval de
// las pestañas ocultas, así que contar ticks atrasaría la alarma justo cuando
// más importa — con el teléfono bloqueado. Comparando contra un instante fijo,
// que el tick llegue tarde sólo significa que la alarma suena apenas tarde, no
// que se pierda.
import { S, bump } from './state.js';
import { vibrate } from './format.js';
import { toast } from './toast.js';
import { prepararAlarma, pedirPermiso, sonar, callar } from './alarm.js';

export const T = { end: 0, total: 0, int: null, audio: null, state: 'hidden', leftSec: 0, pct: 0 };

function audioCtx() {
  if (!T.audio) { try { T.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (T.audio && T.audio.state === 'suspended') T.audio.resume();
  return T.audio;
}

export function ding() {
  vibrate([220, 110, 220, 110, 320]);
  const ctx = audioCtx(); if (!ctx) return;
  [0, .22, .44].forEach((t, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880;
    const at = ctx.currentTime + t;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(.35, at + .02);
    g.gain.exponentialRampToValueAtTime(.0001, at + .18);
    o.start(at); o.stop(at + .2);
  });
}

export const REST_CIRC = 2 * Math.PI * 88;

export function startRest() {
  if (!S.cfg.rest) return;
  audioCtx();        // crear con gesto del usuario
  prepararAlarma();  // desbloquear el <audio> con el mismo gesto
  pedirPermiso();
  T.total = S.cfg.rest; T.end = Date.now() + T.total * 1000;
  T.state = 'fullscreen';
  bump();
  if (!T.int) T.int = setInterval(tickRest, 250);
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
  T.state = 'hidden';
  bump();
}

/** Recupera el descanso al volver a la app.

    El navegador puede haber congelado los timers mientras estabas en otra app.
    Al volver, esto compara contra T.end y dispara la alarma si el descanso
    venció mientras no mirabas — sin esto la pantalla se quedaría en un número
    viejo, esperando un tick que nunca llegó. */
export function recuperarRest() {
  if (T.state === 'hidden' || T.state === 'ringing') return;
  if (Date.now() >= T.end) terminar();
  else tickRest();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recuperarRest();
  });
}
