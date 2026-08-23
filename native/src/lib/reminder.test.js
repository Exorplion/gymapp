// Tests de reminder.js — función nueva sin equivalente web (ver header de
// reminder.js). Igual que alarm.test.js, NO se mockea el módulo bajo
// prueba: se importa real y se ejercita contra el mock global de
// expo-notifications (jest.setup.js), así se verifica el objeto exacto que
// arma reminder.js, incluido el trigger (misma clase de bug que costó 2
// rondas de fix en Etapa 6a con TIME_INTERVAL — acá se chequea DATE).
import * as Notifications from 'expo-notifications';
import { S } from './state.js';
import { scheduleTomorrowReminder, cancelReminder } from './reminder.js';

// El módulo guarda el id programado en estado interno (R.scheduledNotifId),
// que persiste entre tests dentro de este archivo (mismo módulo, no se
// resetea solo). Se limpia acá para que cada test empiece sin nada
// programado, sin depender del orden de ejecución de los demás.
beforeEach(() => cancelReminder());

function baseRoutine() {
  return [
    { id: 'a', order: 0, name: 'Empuje', exercises: [{ id: 'e1', name: 'Press', sets: 3, reps: 10 }] },
    { id: 'b', order: 1, name: 'Tirón', exercises: [{ id: 'e2', name: 'Remo', sets: 3, reps: 10 }] },
    { id: 'c', order: 2, type: 'rest' },
  ];
}

beforeEach(() => {
  Notifications.scheduleNotificationAsync.mockClear();
  Notifications.cancelScheduledNotificationAsync.mockClear();
  Notifications.setNotificationChannelAsync.mockClear();
  S.routine = baseRoutine();
  S.cfg = { ...S.cfg, seqIndex: 0, reminderEnabled: true, reminderHour: 18 };
});

describe('scheduleTomorrowReminder', () => {
  it('turno de mañana es descanso -> no programa, cancela lo previo', async () => {
    // seqIndex 0 (Empuje) -> mañana es índice 1 (Tirón)... para forzar
    // descanso mañana, paramos en el turno anterior al de descanso (idx 1).
    S.cfg.seqIndex = 1; // mañana = idx 2 = rest
    await scheduleTomorrowReminder();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('rutina vacía -> no programa, no rompe', async () => {
    S.routine = [];
    await expect(scheduleTomorrowReminder()).resolves.not.toThrow();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reminderEnabled false -> nunca programa, cancela lo existente', async () => {
    S.cfg.reminderEnabled = false;
    await scheduleTomorrowReminder();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled(); // nada que cancelar aún

    // programar uno real primero, activado
    S.cfg.reminderEnabled = true;
    S.cfg.seqIndex = 0; // mañana = idx 1 = Tirón (entrenamiento)
    await scheduleTomorrowReminder();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    // ahora se desactiva: debe cancelar el que había
    S.cfg.reminderEnabled = false;
    await scheduleTomorrowReminder();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('mock-notif-id');
  });

  it('turno de mañana es de entrenamiento -> programa con hora y body correctos', async () => {
    S.cfg.seqIndex = 0; // mañana = idx 1 = Tirón
    S.cfg.reminderHour = 7;
    await scheduleTomorrowReminder();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(arg.content.title).toBe('Hora de entrenar');
    expect(arg.content.body).toBe('Tirón');
    expect(arg.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.DATE);
    expect(arg.trigger.date).toBeInstanceOf(Date);

    const expected = new Date();
    expected.setDate(expected.getDate() + 1);
    expected.setHours(7, 0, 0, 0);
    expect(arg.trigger.date.getTime()).toBe(expected.getTime());
  });

  it('con wraparound del índice (último turno hoy -> mañana vuelve al principio)', async () => {
    S.cfg.seqIndex = 2; // último (rest); mañana = idx 0 = Empuje
    await scheduleTomorrowReminder();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.body).toBe('Empuje');
  });
});

describe('cancelReminder', () => {
  it('es seguro llamarla cuando nunca se programó nada', () => {
    expect(() => cancelReminder()).not.toThrow();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
