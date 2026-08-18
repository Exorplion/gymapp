// Mock de AsyncStorage para tests (jest) — necesario porque
// @react-native-async-storage/async-storage no expone su módulo nativo en
// el entorno de test. Ver docs: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
