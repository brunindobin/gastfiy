/**
 * Setup do Jest.
 *
 * Mockamos apenas o que depende de código nativo (SecureStore, fontes,
 * gradiente) e o AsyncStorage com o mock oficial. O resto roda de verdade:
 * assim os testes validam os componentes reais, não dublês.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  isAvailableAsync: jest.fn(async () => true),
}));

// As fontes do Google não carregam em ambiente de teste: reportamos "prontas".
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => undefined),
  isLoaded: jest.fn(() => true),
}));

// LinearGradient é um componente nativo: no teste vira uma View comum.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// Isolamento entre testes: o AsyncStorage é compartilhado no processo, então
// limpamos antes de cada caso (senão a preferência de tema "vaza").
beforeEach(async () => {
  // O mock oficial é CommonJS (exporta o objeto direto, sem `.default`).
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
});
