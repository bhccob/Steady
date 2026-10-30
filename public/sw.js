// Steady's service worker: lets the installed web app open with no signal. Pages come from the
// network first (so updates arrive), falling back to the last copy; the app's hashed files come
// from the cache first. Cached pages keep their isolation headers, which the database needs.
// The build (scripts/precache.cjs) fills in the cache name and every file of that build.
const CACHE = 'steady-dev';
const PRECACHE = [];
const SHELL = ['/index.html', '/manifest.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/icon-192.png', '/sw-push.js'];

// Reminders: the server sends only `{"id"}`; the words were kept on this phone by the app.
importScripts('/sw-push.js');

function readKv(keys) {
  return new Promise((resolve) => {
    const open = indexedDB.open('steady-web', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve(keys.map(() => undefined));
    open.onsuccess = () => {
      const store = open.result.transaction('kv', 'readonly').objectStore('kv');
      Promise.all(
        keys.map((k) => new Promise((r) => {
          const get = store.get(k);
          get.onsuccess = () => r(get.result);
          get.onerror = () => r(undefined);
        })),
      ).then((values) => {
        open.result.close();
        resolve(values);
      });
    };
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let id = '';
      try {
        id = String(event.data ? event.data.json().id || '' : '');
      } catch {
        id = '';
      }
      const [rec, tomb] = id ? await readKv([`rem:${id}`, `tomb:${id}`]) : [undefined, undefined];
      const notice = self.steadyPush.pushNotice(rec, tomb);
      // Every push must show something, or the browser may stop delivering them.
      await self.registration.showNotification('Steady', { body: notice.body, tag: id || 'steady', icon: '/icon-192.png', data: { doseIds: notice.doseIds } });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow('/home');
    })(),
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Everything this build can load, so even the next open after a first visit works offline.
      await (await caches.open(CACHE)).addAll([...SHELL, ...PRECACHE]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('steady-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          await cache.put('/index.html', response.clone());
          return response;
        } catch {
          return (await caches.match('/index.html')) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await (await caches.open(CACHE)).put(request, response.clone());
        return response;
      })(),
    );
  }
});
