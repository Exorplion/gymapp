// La alarma del final del descanso: suena hasta que la cortás, como la del
// despertador. Puerto de web/src/lib/alarm.js adaptado a RN.
//
// Diferencia clave con el original: acá no hace falta un <audio> real para
// esquivar la suspensión de AudioContext en segundo plano — ese problema es
// exclusivo del navegador. `expo-av` reproduce sobre el motor de audio nativo
// del sistema operativo, que sigue sonando con la pantalla apagada sin
// ningún truco adicional.
//
// El WAV tampoco se sintetiza en runtime acá: se generó UNA VEZ con
// native/scripts/gen-rest-alarm-wav.js (misma matemática que
// muestrasAlarma() del original: 3 pitidos ascendentes, 22050 Hz mono 16
// bits, rampas de 8ms) y quedó empaquetado como asset del bundle en
// native/assets/sounds/rest-alarm.wav. Es un archivo local del bundle, no
// depende de red — mismo principio del original ("no hay nada que
// descargar"), sólo que la síntesis se hizo offline una vez en vez de cada
// vez que arranca la alarma.
//
// LÍMITE HONESTO: si el sistema mata el proceso de la app del todo, no suena
// nada más que la notificación del sistema operativo. Eso es esperable y es
// el mismo límite que el original documenta para Android/navegador.
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { vibrate } from './format.js';

/** Canal de notificación requerido en Android 8+ (API 26+) para que
    scheduleNotificationAsync muestre algo. Se crea una sola vez, la primera
    vez que se pide permiso — crearlo de más no rompe nada
    (setNotificationChannelAsync es idempotente: reemplaza si ya existe). */
let canalListo = false;
async function asegurarCanal() {
  if (canalListo || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('descanso', {
      name: 'Descanso terminado',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
    });
    canalListo = true;
  } catch {
    // sin canal, la notificación puede no sonar en Android pero no rompe
  }
}

/** Pide permiso de notificaciones. Hay que llamarla desde un gesto del
    usuario (se llama desde startRest(), que sale de tocar un botón). */
export async function pedirPermiso() {
  await asegurarCanal();
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Cuánto suena antes de callarse sola, en ms. Ver comentario del original:
    un despertador también se rinde si te olvidaste el timer. */
const TOPE = 120000;

/** Cada cuánto se repite el patrón de vibración mientras suena. Coincide con
    la duración del WAV (2s) para que la vibración caiga junto con los
    pitidos. */
const CICLO = 2000;

const asset = require('../../assets/sounds/rest-alarm.wav');

const A = { sound: null, int: null, desde: 0, notifId: null, sonando: false, scheduledNotifId: null };

/**
 * Deja el sonido de la alarma pre-cargado, sin gesto del usuario.
 *
 * A diferencia del original —que necesitaba "destrabar" el <audio> con un
 * play/pause mudo por las restricciones de autoplay del navegador—, en RN no
 * existe esa restricción cuando el sonido arranca desde sonar() (que a su
 * vez sale de un gesto). Acá esta función se usa para precargar el asset de
 * audio de antemano, así sonar() no tiene que esperar el createAsync() en el
 * momento exacto en que termina el descanso.
 */
export async function prepararAlarma() {
  if (A.sound) return;
  try {
    const { sound } = await Audio.Sound.createAsync(asset, { isLooping: true, shouldPlay: false });
    A.sound = sound;
  } catch {
    // sin audio queda la vibración y la notificación
  }
}

/** ¿Está sonando ahora? */
export const sonando = () => A.sonando;

/**
 * Programa la notificación local para el instante exacto en que el
 * descanso termina, dejando que el sistema operativo la dispare — no este
 * código JS. Esto es lo que hace que funcione con la app en segundo plano
 * o la pantalla bloqueada: si dependiera de que sonar() corra en el
 * momento justo, el caso que más importa cubrir (JS congelado) es
 * exactamente el que no la dispararía.
 */
export async function scheduleEndNotification(secondsFromNow, body) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Descanso terminado',
        body,
        ...(Platform.OS === 'android' ? { channelId: 'descanso' } : {}),
      },
      trigger: { seconds: Math.max(1, Math.round(secondsFromNow)), ...(Platform.OS === 'android' ? { channelId: 'descanso' } : {}) },
    });
    A.scheduledNotifId = id;
    return id;
  } catch {
    // sin notificaciones queda el sonido/vibración en primer plano
    return null;
  }
}

/** Cancela la notificación programada por scheduleEndNotification(), si
    hay una pendiente. No-op si no hay nada programado. */
export function cancelScheduledNotification() {
  if (!A.scheduledNotifId) return;
  const id = A.scheduledNotifId;
  A.scheduledNotifId = null;
  Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/**
 * Arranca la alarma: suena y vibra en loop hasta que la cortan.
 *
 * `alCallar` se llama cuando se calla sola por el tope, para que quien la
 * arrancó pueda actualizar su estado en vez de quedarse creyendo que suena.
 *
 * Idempotente: si ya está sonando, no hace nada.
 */
export async function sonar(texto, alCallar) {
  if (A.sonando) return;
  A.sonando = true;
  A.desde = Date.now();

  let sound = null;
  try {
    if (!A.sound) await prepararAlarma();
    sound = A.sound;
  } catch {
    // sin permiso/hardware de audio quedan la vibración y la notificación
  }

  // Entre los `await`s de arriba, callar() pudo haber corrido (p.ej. el
  // usuario tocó PARAR justo cuando la alarma estaba arrancando). Si eso
  // pasó, A.sonando ya está en false: hay que abortar acá, ANTES de tocar
  // sonido/vibración/intervalo, para que la alarma nunca arranque después
  // de que ya le dijeron que pare.
  if (!A.sonando) {
    if (sound) sound.stopAsync().catch(() => {});
    return;
  }

  try {
    if (sound) {
      await sound.setIsLoopingAsync(true);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch {
    // sin permiso/hardware de audio quedan la vibración y la notificación
  }

  // Mismo re-chequeo después de la segunda tanda de awaits (setIsLooping/
  // setPosition/playAsync también son asincrónicos).
  if (!A.sonando) {
    if (sound) sound.stopAsync().catch(() => {});
    return;
  }

  const pulso = () => vibrate([400, 200, 400, 200, 400]);
  pulso();

  A.int = setInterval(() => {
    if (Date.now() - A.desde >= TOPE) {
      callar();
      if (alCallar) alCallar();
      return;
    }
    pulso();
  }, CICLO);
}

/** La corta. Es idempotente: llamarla dos veces (o sin haber sonado nunca)
    no rompe nada. */
export function callar() {
  if (A.int) { clearInterval(A.int); A.int = null; }
  A.sonando = false;
  if (A.sound) {
    A.sound.stopAsync().catch(() => {});
    // Se descarta acá: esta alarma se crea y se corta una vez por cada
    // descanso a lo largo de toda la vida de la app, así que no puede
    // asumirse un único objeto de sonido eterno — sonar() lo vuelve a crear
    // (vía prepararAlarma()) la próxima vez que haga falta.
    A.sound.unloadAsync().catch(() => {});
    A.sound = null;
  }
  vibrate(0);
  // Sólo se apunta a la notificación de ESTA alarma, nunca a un
  // dismiss-all: eso se llevaría por delante cualquier otra notificación
  // que la app tenga por su cuenta, sin relación con el descanso.
  if (A.notifId) {
    Notifications.dismissNotificationAsync(A.notifId).catch(() => {});
    A.notifId = null;
  }
}
