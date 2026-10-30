import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Runs the real public/sw.js with a fake worker around it, to check what it keeps as the offline
// copy of the app's page.
const SOURCE = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

type Reply = { ok: boolean; status: number; clone(): Reply };
const reply = (status: number): Reply => ({ ok: status >= 200 && status < 300, status, clone: () => reply(status) });

function worker(network: () => Promise<Reply>) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const stored = new Map<string, Reply>();
  const cache = { put: async (key: string, value: Reply) => void stored.set(key, value), addAll: async () => {} };
  const caches = { open: async () => cache, match: async (key: string) => stored.get(key), keys: async () => [], delete: async () => true };
  const self = { addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn), location: { origin: 'https://steady.example' } };
  const ResponseStub = { error: () => reply(0) };
  new Function('self', 'caches', 'fetch', 'importScripts', 'indexedDB', 'Response', SOURCE)(self, caches, network, () => {}, {}, ResponseStub);

  const open = async (): Promise<Reply> => {
    let answer: Promise<Reply> | undefined;
    listeners.fetch!({ request: { url: 'https://steady.example/home', method: 'GET', mode: 'navigate' }, respondWith: (p: Promise<Reply>) => (answer = p) });
    return answer!;
  };
  return { open, stored };
}

it('keeps a real page as the offline copy', async () => {
  const sw = worker(async () => reply(200));
  expect((await sw.open()).status).toBe(200);
  expect(sw.stored.get('/index.html')?.status).toBe(200);
});

it("shows an error or Vercel's security checkpoint (403) but never keeps it as the offline copy", async () => {
  const sw = worker(async () => reply(403));
  expect((await sw.open()).status).toBe(403);
  expect(sw.stored.has('/index.html')).toBe(false);
});

it('opens the offline copy when there is no connection', async () => {
  let online = true;
  const sw = worker(async () => (online ? reply(200) : Promise.reject(new TypeError('offline'))));
  await sw.open();
  online = false;
  expect((await sw.open()).status).toBe(200);
});
