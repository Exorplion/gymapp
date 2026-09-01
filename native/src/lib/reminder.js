// native/src/lib/reminder.js
//
// FUNCIÓN NUEVA, SIN EQUIVALENTE EN LA WEB — a diferencia de todo archivo
// anterior de esta migración (que siempre porta un web/src/lib/*.js
// existente), acá no hay nada que portar: la app web original no tiene
// ningún recordatorio de entrenamiento (grep confirmado sobre `reminder`/
// `recordatorio` en web/src, sin resultados de lógica real). El spec de
// migración pide "notificaciones push (recordatorio de entrenar...)" para
// esta etapa, pero eso sólo tiene sentido con notificaciones locales reales
// — algo que la PWA original no podía ofrecer de forma confiable.
//
// Diseño (ver docs/superpowers/plans/2026-08-22-rn-etapa6b-...): una
// notificación local para MAÑANA a S.cfg.reminderHour:00, sólo si el turno
// de mañana (S.routine[(S.cfg.seqIndex + 1) % S.routine.length]) no es de
// descanso. Se reprograma en cada arranque de la app y cada vez que se
// completa una sesión (Task 2 conecta esos dos puntos) — no existe un
// trigger repetido de expo-notifications que pueda expresar "sólo si hay
// algo pendiente", así que la condición se recalcula en JS cada vez.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { S } from './state.js';

/** Canal de Android propio para recordatorios, separado de 'descanso'
    (alarm.js): son avisos de naturaleza distinta (uno es "tu descanso
    terminó, ahora mismo", el otro es "acordate de entrenar, en general") y
    el usuario puede querer silenciar uno sin el otro desde los ajustes del
    sistema operativo. Mismo patrón que asegurarCanal() en alarm.js:
    idempotente, se intenta una sola vez por proceso. */
let canalListo = false;
async function asegurarCanal() {
  if (canalListo || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
    });
    canalListo = true;
  } catch {
    // sin canal, la notificación puede no sonar en Android pero no rompe
  }
}

/** Identifier ESTABLE de la notificación de recordatorio — no un id generado
    dinámicamente. Programar con este mismo identifier vía
    scheduleNotificationAsync({ identifier, ... }) REEMPLAZA cualquier
    notificación pendiente con ese identifier, tanto en Android como en iOS
    (confirmado leyendo node_modules/expo-notifications/build/
    scheduleNotificationAsync.js: usa `request.identifier ?? uuid.v4()` como
    id nativo). Esto reemplaza el tracking en memoria de proceso
    (R.scheduledNotifId) que se perdía en cada cold-start de la app y
    causaba recordatorios duplicados sin cancelar entre reinicios. */
const REMINDER_NOTIFICATION_ID = 'recordatorio-diario';

/** Cancela la notificación de recordatorio programada, si hay una.
    Incondicional: no depende de ningún estado en memoria (ya no existe
    R.scheduledNotifId) — cancelar un identifier que no tiene nada
    programado es un no-op seguro en ambas plataformas (confirmado en
    node_modules/expo-notifications/build/cancelScheduledNotificationAsync.js:
    "resolves once the scheduled notification is successfully canceled OR IF
    THERE IS NO SCHEDULED NOTIFICATION for a given identifier"). Envuelta en
    try/catch: es un efecto secundario no crítico, no debe romper el flujo
    que la llama. */
export function cancelReminder() {
  try {
    Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID).catch(() => {});
  } catch {
    // no crítico
  }
}

/** Recalcula si mañana amerita recordatorio y programa/cancela según
    corresponda. Pensada para llamarse al arrancar la app y cada vez que se
    completa una sesión (avanza S.cfg.seqIndex) — ver Task 2. */
export async function scheduleTomorrowReminder() {
  // SIEMPRE se cancela lo que hubiera antes de decidir de nuevo: nunca debe
  // quedar más de un recordatorio pendiente a la vez.
  cancelReminder();

  // Defensivo: si Task 2 todavía no corrió (agrega estos campos a los
  // defaults de S.cfg en state.js), usa los mismos defaults documentados en
  // el plan (reminderHour: 18, reminderEnabled: true) para que este módulo
  // funcione igual antes y después de esa conexión.
  const enabled = S.cfg.reminderEnabled !== false;
  const hour = S.cfg.reminderHour ?? 18;

  if (!enabled) return;
  if (!S.routine.length) return;

  // El turno de mañana es el siguiente al puntero actual de la secuencia.
  // pendingSlot() (session.js) indexa S.routine[S.cfg.seqIndex] directo sin
  // wraparound porque ese índice siempre está en rango (resolveAutoRest()
  // en state.js lo mantiene así); acá sí hace falta el módulo porque sumar
  // 1 puede pasarse del final del arreglo.
  //
  // Nota sobre "¿ya entrené hoy?": no hace falta un chequeo aparte de
  // sessionForSlot() para el turno de MAÑANA — completeSession() (session.js)
  // ya avanza S.cfg.seqIndex al completar la sesión de HOY, así que este
  // cálculo (que lee seqIndex en el momento en que corre) automáticamente
  // refleja el estado post-completado: si el usuario ya entrenó hoy antes de
  // que esta función corra, "mañana" ya apunta al turno correcto (el que de
  // verdad sigue), no al que ya se completó. El único caso que esto NO
  // cubre es una sesión registrada a mano para la fecha de mañana sin pasar
  // por completeSession() (que sí avanza seqIndex) — un caso de edición
  // manual fuera de flujo que no tiene sentido de producto para "mañana"
  // (nadie registra por adelantado un día que no pasó) y por eso se decide
  // no sumarle una consulta extra a sessionForSlot() acá.
  const idx = (S.cfg.seqIndex + 1) % S.routine.length;
  const slot = S.routine[idx];
  if (!slot || slot.type === 'rest') return;

  await asegurarCanal();

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  fecha.setHours(hour, 0, 0, 0);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_NOTIFICATION_ID,
      content: {
        title: 'Hora de entrenar',
        body: slot.name || 'Tu rutina',
        ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fecha,
        ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
      },
    });
    return id;
  } catch {
    // sin notificaciones no hay recordatorio, pero no debe romper el arranque
    return null;
  }
}
