// Mock de AsyncStorage para tests (jest) — necesario porque
// @react-native-async-storage/async-storage no expone su módulo nativo en
// el entorno de test. Ver docs: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mocks de expo-av y expo-notifications para tests (jest) — igual que
// AsyncStorage arriba, sus módulos nativos no existen en el entorno de
// test. Sólo se mockean las funciones que src/lib/alarm.js usa.
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            setIsLoopingAsync: jest.fn(() => Promise.resolve()),
            setPositionAsync: jest.fn(() => Promise.resolve()),
            playAsync: jest.fn(() => Promise.resolve()),
            stopAsync: jest.fn(() => Promise.resolve()),
          },
        })
      ),
    },
  },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notif-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissAllNotificationsAsync: jest.fn(() => Promise.resolve()),
}));
