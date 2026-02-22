jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { initStorage, mmkvStorage, storageReady } from '../../storage';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initStorage', () => {
  it('resolves storageReady promise', async () => {
    await initStorage();
    await expect(storageReady).resolves.toBeUndefined();
  });

  it('generates and persists encryption key on first run', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    await initStorage();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'mmkv_encryption_key',
      expect.stringMatching(/^[0-9a-f]{32}$/),
    );
  });

  it('reuses existing encryption key', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('existing-key');
    await initStorage();
    expect(MMKV).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKey: 'existing-key' }),
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('mmkvStorage adapter', () => {
  beforeEach(async () => {
    await initStorage();
  });

  it('getItem returns null for missing key', () => {
    expect(mmkvStorage.getItem('missing')).toBeNull();
  });

  it('setItem calls set on MMKV instance', () => {
    mmkvStorage.setItem('foo', 'bar');
    const mock = (MMKV as jest.Mock).mock.results[0].value;
    expect(mock.set).toHaveBeenCalledWith('foo', 'bar');
  });

  it('removeItem calls delete on MMKV instance', () => {
    mmkvStorage.removeItem('foo');
    const mock = (MMKV as jest.Mock).mock.results[0].value;
    expect(mock.delete).toHaveBeenCalledWith('foo');
  });
});
