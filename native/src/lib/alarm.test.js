// Test dirigido al bug Crítico de la ronda 2 de revisión de Etapa 6a: el
// trigger de scheduleEndNotification() no incluía `type`, lo que hacía que
// expo-notifications lo interpretara mal (ver
// node_modules/expo-notifications/build/scheduleNotificationAsync.js:
// parseTimeIntervalTrigger sólo matchea si `type` === TIME_INTERVAL).
//
// A propósito NO se mockea alarm.js: este test importa el módulo real y
// llama a la función real, para ejercitar el mismo código que corre en la
// app. Lo único mockeado es expo-notifications (ya globalmente, vía
// jest.setup.js — igual que expo-av), así que lo que se verifica acá es el
// objeto exacto que alarm.js arma y le pasa a scheduleNotificationAsync.
import * as Notifications from 'expo-notifications';
import { scheduleEndNotification } from './alarm.js';

describe('scheduleEndNotification (trigger real, no mockeado)', () => {
  beforeEach(() => {
    Notifications.scheduleNotificationAsync.mockClear();
  });

  it('arma un trigger con type: TIME_INTERVAL y los seconds correctos', async () => {
    const id = await scheduleEndNotification(90, 'test body');

    expect(id).toBe('mock-notif-id');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];

    // Éste es el chequeo que habría detectado el bug: sin `type`,
    // expo-notifications real ni siquiera reconoce esto como un trigger de
    // intervalo (en Android cae al fallback de canal, que dispara
    // inmediatamente; en iOS tira un TypeError).
    expect(arg.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL);
    expect(arg.trigger.seconds).toBe(90);
    expect(arg.content.body).toBe('test body');
  });

  it('redondea hacia arriba y nunca manda seconds < 1', async () => {
    await scheduleEndNotification(0.2, 'x');
    const arg = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.trigger.seconds).toBe(1);
  });
});
