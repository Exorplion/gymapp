// La alarma del final del descanso: suena hasta que la cortás, como la del
// despertador.
//
// Por qué no alcanzaba con el ding() de Web Audio que había antes: un
// AudioContext se SUSPENDE cuando el navegador pasa a segundo plano. Si dejabas
// el teléfono bloqueado durante el descanso —que es exactamente lo que uno
// hace— el oscilador no sonaba nunca. Un <audio> de verdad sigue reproduciendo
// con la pantalla apagada, y encima mantiene la pestaña despierta, así que el
// setInterval del reloj tampoco se congela.
//
// El sonido se sintetiza acá y no es un archivo: un WAV de dos segundos que se
// repite en loop. Así no hay nada que descargar, la app sigue funcionando sin
// red, y no engorda el bundle porque se genera recién cuando hace falta.
//
// LÍMITE HONESTO: si Android mata el navegador, no suena nada. Eso no se puede
// arreglar sin un servidor que mande push, y FIERRO es 100% local. Lo que sí
// está cubierto es lo que pasa siempre: pantalla apagada, otra app encima, o la
// app en segundo plano.
import { vibrate } from './format.js';
import { notificar, cerrarNotificacion, TAG_DESCANSO } from './notify.js';

export { pedirPermiso } from './notify.js';

/** Cuánto suena antes de callarse sola, en ms.

    Un despertador de teléfono también se rinde: si te fuiste del gimnasio y te
    olvidaste el timer, que suene para siempre no ayuda a nadie. */
const TOPE = 120000;

/** Cada cuánto se repite el patrón. Coincide con la duración del WAV para que
    la vibración caiga junto con los pitidos y no en el silencio. */
const CICLO = 2000;

const A = { url: null, el: null, int: null, desde: 0, listo: false, falló: false };

/** [arranque, fin, frecuencia] de cada pitido, en segundos.

    El tercero sube de tono: es lo que hace que suene a "listo" y no a "error". */
export const PITIDOS = [[0, .16, 880], [.26, .42, 880], [.52, .70, 1175]];
export const SR = 22050;
export const DUR = 2;

/** El WAV crudo: tres pitidos y silencio, el patrón de un despertador.

    22050 Hz mono de 16 bits. Se sintetiza a mano porque un archivo habría que
    descargarlo, y esta app tiene que andar sin red.

    Va separado de sintetizar() para poder testear que efectivamente suena: una
    alarma muda es el peor fallo de todos y el más difícil de notar. */
export function muestrasAlarma() {
  const sr = SR, dur = DUR, n = sr * dur;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let m = 0;
    for (const [a, b, f] of PITIDOS) {
      if (t < a || t >= b) continue;
      const d = t - a, largo = b - a;
      // rampa de 8 ms en cada punta: sin esto cada pitido arranca y corta con
      // un chasquido
      const env = Math.min(1, d / .008, (largo - d) / .008);
      m += Math.sin(2 * Math.PI * f * t) * env;
    }
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, m)) * 32767 * .85, true);
  }
  return buf;
}

/** Suelta el elemento de audio del todo.

    Pausarlo no alcanza: mientras haya un <audio> vivo en la página, Android
    deja las teclas de volumen en el canal multimedia, y el teléfono se queda
    así hasta que cerrás la app. Bajarle el volumen al timbre de tus mensajes
    porque hace media hora sonó un descanso es un efecto que nadie pidió.

    Por eso se desmonta entero —pausar, soltar el recurso, sacarlo del DOM— y se
    vuelve a crear en el próximo descanso. Crearlo es barato: el WAV ya está
    sintetizado y el blob se reusa. */
function soltar() {
  const el = A.el;
  A.el = null;
  A.listo = false;   // habrá que volver a desbloquearlo con un gesto
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute('src');
    el.load();       // fuerza al navegador a largar el recurso
    el.remove();
  } catch { /* ya estaba desmontado */ }
  try {
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  } catch { /* sin MediaSession */ }
}

/** El elemento de audio. Se crea al preparar cada descanso y se suelta al
    cortar la alarma.

    Devuelve null si el navegador no lo deja: la alarma se degrada a vibración y
    notificación en vez de tirar abajo el final del descanso. */
function elemento() {
  if (A.el === null && !A.falló) {
    try {
      A.url = A.url || URL.createObjectURL(new Blob([muestrasAlarma()], { type: 'audio/wav' }));
      A.el = new Audio(A.url);
      A.el.loop = true;
      A.el.preload = 'auto';
      // Colgado del documento y no suelto: así Android lo toma como medio de la
      // página y le da los controles del sistema. Un <audio> sin controls no
      // ocupa espacio, no hace falta esconderlo.
      document.body.appendChild(A.el);
    } catch { A.falló = true; }
  }
  return A.el;
}

/**
 * Deja la alarma lista para sonar después, sin gesto del usuario.
 *
 * iOS y Android sólo dejan reproducir audio si el elemento ya sonó al menos una
 * vez durante un gesto. Se lo hace sonar y se lo corta en el acto: en la
 * práctica es inaudible, y sin esto el play() del final del descanso lo bloquea
 * el navegador.
 *
 * Hay que llamarla DESDE un gesto — al arrancar el descanso, que sale de tocar
 * un botón.
 */
export function prepararAlarma() {
  if (A.listo) return;
  const el = elemento();
  if (!el) return;
  const vol = el.volume;
  el.volume = 0;
  const p = el.play();
  const cerrar = () => { el.pause(); el.currentTime = 0; el.volume = vol; A.listo = true; };
  if (p && p.then) p.then(cerrar).catch(() => { el.volume = vol; });
  else cerrar();
}

/** ¿Está sonando ahora? */
export const sonando = () => A.int !== null;

/**
 * Arranca la alarma: suena y vibra en loop hasta que la cortan.
 *
 * `alCallar` se llama cuando se calla sola por el tope, para que quien la
 * arrancó pueda actualizar su estado en vez de quedarse creyendo que suena.
 */
export function sonar(texto, alCallar) {
  if (A.int) return;
  A.desde = Date.now();

  const el = elemento();
  if (el) {
    el.currentTime = 0;
    // sin permiso de audio quedan la vibración y la notificación
    try { el.play()?.catch?.(() => {}); } catch { /* bloqueado */ }
  }

  const pulso = () => vibrate([400, 200, 400, 200, 400]);
  pulso();
  notificar('Descanso terminado', {
    body: texto,
    tag: TAG_DESCANSO,
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400],
  });

  A.int = setInterval(() => {
    if (Date.now() - A.desde >= TOPE) { callar(); if (alCallar) alCallar(); return; }
    pulso();
  }, CICLO);
}

/** La corta. Es idempotente: llamarla dos veces no rompe nada. */
export function callar() {
  if (A.int) { clearInterval(A.int); A.int = null; }
  if (A.el) { A.el.pause(); A.el.currentTime = 0; }
  vibrate(0);
  soltar();
  cerrarNotificacion(TAG_DESCANSO);
}
