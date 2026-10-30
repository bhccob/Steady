// A tiny key-value store for web reminders. In the browser it's IndexedDB, under names the
// service worker reads too (public/sw-push.js); tests use the in-memory one.

export const KV_DB = 'steady-web';
export const KV_STORE = 'kv';

export interface Kv {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export function memoryKv(): Kv {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return structuredClone(map.get(key)) as T | undefined;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async del(key) {
      map.delete(key);
    },
    async keys(prefix) {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let opened: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(KV_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(KV_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return opened;
}

export function idbKv(): Kv {
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(KV_STORE, mode).objectStore(KV_STORE);
  return {
    async get<T>(key: string) {
      return (await request((await store('readonly')).get(key))) as T | undefined;
    },
    async set(key, value) {
      await request((await store('readwrite')).put(value, key));
    },
    async del(key) {
      await request((await store('readwrite')).delete(key));
    },
    async keys(prefix) {
      const all = (await request((await store('readonly')).getAllKeys())) as string[];
      return all.filter((k) => typeof k === 'string' && k.startsWith(prefix));
    },
  };
}
