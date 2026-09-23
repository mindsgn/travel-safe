import * as SecureStore from 'expo-secure-store';

/**
 * All locally persisted data (tokens, profile, contacts cache, offline queue) lives in
 * the Keychain / Android Keystore via expo-secure-store; nothing goes to AsyncStorage.
 * SecureStore warns above ~2 KB per value, so JSON is split across numbered chunks.
 */
export const CHUNK_SIZE = 1800;

export type KeyValueBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

// AFTER_FIRST_UNLOCK so background tasks can read credentials while the phone is locked.
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureBackend: KeyValueBackend = {
  getItem: (key) => SecureStore.getItemAsync(key, secureOptions),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, secureOptions),
};

export function createMemoryBackend(initial: Record<string, string> = {}): KeyValueBackend & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    deleteItem: async (key) => {
      data.delete(key);
    },
  };
}

export function chunk(value: string, size: number = CHUNK_SIZE): string[] {
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += size) parts.push(value.slice(index, index + size));
  return parts.length > 0 ? parts : [''];
}

export type JsonStore = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
};

export function createJsonStore(backend: KeyValueBackend = secureBackend): JsonStore {
  const countKey = (key: string) => `${key}.count`;
  const partKey = (key: string, index: number) => `${key}.${index}`;

  async function readCount(key: string): Promise<number> {
    const raw = await backend.getItem(countKey(key));
    const count = raw ? Number(raw) : 0;
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  async function removeParts(key: string, from: number, to: number): Promise<void> {
    for (let index = from; index < to; index += 1) await backend.deleteItem(partKey(key, index));
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      const count = await readCount(key);
      if (count === 0) return null;
      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await backend.getItem(partKey(key, index));
        if (part === null) return null;
        parts.push(part);
      }
      try {
        return JSON.parse(parts.join('')) as T;
      } catch {
        return null;
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      const parts = chunk(JSON.stringify(value));
      const previous = await readCount(key);
      for (let index = 0; index < parts.length; index += 1) await backend.setItem(partKey(key, index), parts[index]);
      await backend.setItem(countKey(key), String(parts.length));
      await removeParts(key, parts.length, previous);
    },
    async remove(key: string): Promise<void> {
      const count = await readCount(key);
      await backend.deleteItem(countKey(key));
      await removeParts(key, 0, count);
    },
  };
}
