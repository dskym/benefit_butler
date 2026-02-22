import { Platform } from 'react-native';
import { StateStorage } from 'zustand/middleware';

export interface MMKVLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

let _mmkv: MMKVLike | null = null;
let _resolveReady: () => void;

export const storageReady: Promise<void> = new Promise((resolve) => {
  _resolveReady = resolve;
});

export async function initStorage(): Promise<void> {
  if (Platform.OS === 'web') {
    _resolveReady();
    return;
  }
  try {
    // Use require() instead of dynamic import() — Jest VM doesn't support
    // dynamic import() without --experimental-vm-modules
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    const KEY_ID = 'mmkv_encryption_key';

    let encKey = await SecureStore.getItemAsync(KEY_ID);
    if (!encKey) {
      const bytes = new Uint8Array(16);
      (global as any).crypto?.getRandomValues(bytes) ??
        bytes.forEach((_, i, a) => (a[i] = Math.floor(Math.random() * 256)));
      encKey = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await SecureStore.setItemAsync(KEY_ID, encKey);
    }
    _mmkv = new MMKV({ id: 'benefit-butler', encryptionKey: encKey });
  } catch (err) {
    console.warn('[storage] MMKV init failed, using in-memory fallback', err);
    const store = new Map<string, string>();
    _mmkv = {
      getString: (k) => store.get(k),
      set: (k, v) => store.set(k, v),
      delete: (k) => store.delete(k),
    };
  } finally {
    _resolveReady();
  }
}

export const mmkvStorage: StateStorage = {
  getItem: (key) => _mmkv?.getString(key) ?? null,
  setItem: (key, value) => _mmkv?.set(key, value),
  removeItem: (key) => _mmkv?.delete(key),
};

// Zustand persist storage factory — web: AsyncStorage, native: MMKV
export function createPlatformStorage() {
  if (Platform.OS === 'web') {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const { createJSONStorage } = require('zustand/middleware');
    return createJSONStorage(() => AsyncStorage);
  }
  const { createJSONStorage } = require('zustand/middleware');
  return createJSONStorage(() => mmkvStorage);
}
