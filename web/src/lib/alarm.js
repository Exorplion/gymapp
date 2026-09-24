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
import { notificar, cerrarNotificacion, avisoActivo, TAG_DESCANSO } from './notify.js';

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

/** Suelta el RECURSO de audio, pero no el elemento.

    Éste es el arreglo del bug de volumen: un <audio> con `src` cargado es, para
    Android, un reproductor de medios activo — las teclas de volumen pasan a
    controlar el canal multimedia en vez del timbre, y se quedan así todo el
    descanso. Pausarlo no alcanza; hay que largar el recurso (`removeAttribute` +
    `load()`). Sin src el elemento no reclama nada.

    Lo que NO se hace es sacarlo del DOM ni tirarlo: el permiso de "activado por
    un gesto del usuario" que guardan los navegadores es POR ELEMENTO y sobrevive
    a que se le saque y se le vuelva a poner el src. Si lo destruyéramos habría
    que volver a desbloquearlo con otro gesto, y el gesto no existe al final del
    descanso —ahí no hay nadie tocando la pantalla, que es justamente el caso que
    esta alarma tiene que cubrir. */
function soltar() {
  const el = A.el;
  if (!el) return;
  try {
    el.pause();
    el.removeAttribute('src');
    el.load();       // fuerza al navegador a largar el recurso
  } catch { /* nada que soltar */ }
  try {
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  } catch { /* sin MediaSession */ }
}

/** Le vuelve a poner el src. Sólo justo antes de que tenga que sonar de verdad:
    desde acá hasta callar() el teléfono queda en modo multimedia, y ese rato
    tiene que ser el mínimo posible. */
function tomar(el) {
  try {
    if (el.getAttribute('src') !== A.url) { el.src = A.url; el.load(); }
  } catch { /* el navegador no lo deja; quedan vibración y notificación */ }
}

/** El elemento de audio. Se crea UNA vez y vive lo que vive la página.

    Nace con src para poder desbloquearse, y `prepararAlarma()` lo suelta ni bien
    lo consigue. Ver soltar() para por qué no se destruye nunca.

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
 *
 * Apenas termina de desbloquearlo le suelta el recurso: el elemento se queda
 * activado pero sin src, así el teléfono no pasa al canal multimedia durante
 * todo el descanso. El src vuelve recién en sonar().
 *
 * Como la activación es permanente, del segundo descanso en adelante esto no
 * reproduce nada — sólo se asegura de que el recurso siga suelto.
 */
export function prepararAlarma() {
  const el = elemento();
  if (!el) return;
  if (A.listo) { soltar(); return; }
  tomar(el);
  const vol = el.volume;
  el.volume = 0;
  let p;
  try { p = el.play(); } catch { /* bloqueado */ }
  const cerrar = () => { el.volume = vol; A.listo = true; soltar(); };
  // Si lo bloquearon, igual soltamos: sin activación la alarma se degrada a
  // vibración + notificación, pero no tiene sentido que además se quede el
  // volumen del teléfono.
  if (p && p.then) p.then(cerrar).catch(() => { el.volume = vol; soltar(); });
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
    // Recién acá vuelve el src: es el único momento en que la alarma tiene que
    // sonar de verdad, y por lo tanto el único en que vale ocupar el canal
    // multimedia del teléfono.
    tomar(el);
    el.currentTime = 0;
    // sin permiso de audio quedan la vibración y la notificación
    try { el.play()?.catch?.(() => {}); } catch { /* bloqueado */ }
  }

  const pulso = () => vibrate([400, 200, 400, 200, 400]);
  pulso();
  // Sonido y vibración no dependen de esto: apagar el AVISO en Ajustes saca
  // la notificación de la barra, no la alarma.
  if (avisoActivo('descanso')) notificar('Descanso terminado', {
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

/** La corta. Es idempotente: llamarla dos veces no rompe nada.

    Suelta el recurso pero deja vivo el elemento, así el teléfono vuelve al
    volumen de timbre sin que perdamos la activación por gesto. */
export function callar() {
  if (A.int) { clearInterval(A.int); A.int = null; }
  vibrate(0);
  soltar();
  cerrarNotificacion(TAG_DESCANSO);
}
