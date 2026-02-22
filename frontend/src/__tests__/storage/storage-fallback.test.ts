// MMKV throws → AsyncStorage fallback path
// Top-level jest.mock is hoisted before any imports, giving this file its own
// isolated module registry where MMKV always fails.

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => {
    throw new Error('native MMKV module not found');
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initStorage, mmkvStorage } from '../../storage';

beforeAll(async () => {
  await initStorage();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('storage — AsyncStorage fallback (MMKV unavailable)', () => {
  it('getItem delegates to AsyncStorage', async () => {
    await mmkvStorage.getItem('key1');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('key1');
  });

  it('setItem delegates to AsyncStorage', () => {
    mmkvStorage.setItem('key2', 'val2');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('key2', 'val2');
  });

  it('removeItem delegates to AsyncStorage', () => {
    mmkvStorage.removeItem('key3');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('key3');
  });
});
