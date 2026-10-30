# Web Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reminders for the installed web app. A small Cloudflare server sends a "reminder <id> is due" push, and the phone's service worker shows that reminder's words from local storage. The server never holds any text, name, med, mood or dose detail.

**Architecture:**
- **Server:** a Cloudflare Worker (`server/`, its own package) with a D1 database. HTTP routes register an install and replace its upcoming reminder list. A cron trigger every minute sends due pushes (VAPID + Web Push encryption, payload `{"id"}`).
- **Phone:** a `webPushPort` implements the existing `NotificationPort`, so `plan.ts` and `scheduler.ts` are untouched. It keeps each reminder's words in IndexedDB under an opaque id (HMAC of the planned id). A hand-written service worker reads them on push.

**Tech Stack:**
- Server: Cloudflare Workers + D1 + Cron Triggers (free), wrangler, Vitest.
- Phone: Web Push / Push API, IndexedDB, Web Crypto (HMAC-SHA256), Jest.

**Spec:** `docs/superpowers/specs/2026-10-30-steady-web-app-design.md`, section 3 and the "What the server may know" contract. **Depends on:** plan 2 (web app on Vercel, `public/sw.js`, `src/notify/port.web.ts`), with its Task 2 iPhone gate passed.

## Global Constraints

- **The server's whole record:**
  - an install id and secret hash;
  - the push endpoint, `p256dh` and `auth`;
  - per reminder: an opaque id, its due time and its kind (`dose` | `dose_final` | `bedtime` | `other` | `keep`).
- **The server routes keep only those fields.** Anything else in a request body is dropped before it reaches the store.
- **The push payload is exactly** `{"id":"<opaque id>"}`.
- **Opaque ids are** `base64url(HMAC-SHA256(installSecret, plannedId))`, cut to 22 characters. Planned ids, dose ids and words never leave the phone.
- **At most 60 reminders per install,** the planner's `MAX_SCHEDULED`.
- **Due times** are accepted from 1 hour ago to 14 days ahead.
- **Allowed origin (CORS):** the Vercel production URL only.
- **Rate limits:** 30 writes a minute per install, 120 a minute per IP.
- **Every push must show a notification.** iOS revokes push otherwise.
- **The new words follow the copy rules** in `src/notify/copy.ts`: lowercase, no exclamation marks, never "missed". They are:
  - `allMarked`: "you're all marked."
  - `neutral`: "a small mark when you're ready."
  - `keepComing`: "open steady when you can, so your reminders keep coming."
- **The keep-coming notice** is a single one, 60 minutes after the last planned reminder.
- **A failed send** is retried each minute, until 10 minutes past its due time, then dropped. When the push service says the address is gone (404 or 410), the install is deleted. An install with no reminders and no contact for 30 days is deleted.
- **No secrets in the repo or in output.** The VAPID private key goes straight into `wrangler secret put`. The public key is public config.
- **Unchanged:** `npm test`, `npm run lint`, `npm run typecheck` and Android behaviour.

## Review Focus

1. **A dose marked while offline.** The cancel must queue and flush later, and a push that still arrives must say "you're all marked." Pinned by Task 4 (failed flush stays pending) and Task 5 (`pushNotice` with a tombstone).
2. **A request carrying extra fields, such as reminder words.** The server must not store them. Pinned by Task 1 (the store receives only whitelisted fields).
3. **Two tabs or a reinstall registering again.** The same install id with the wrong secret is refused, and a new install gets new ids. Pinned by Task 1 (wrong secret gives 403).
4. **A push address that has expired** (iOS removed permission). The install is cleaned up, not retried for ever. Pinned by Task 2 (`gone` deletes the install).
5. **Delete everything on the web.** The server record goes too, and nothing is left in IndexedDB. Pinned by Task 6 (`forgetReminders` calls the delete and clears the store).

---

### Task 1: The server's routes

**Files:**
- Create: `server/package.json` (scripts `test`: `vitest run`, `deploy`: `wrangler deploy`; devDependencies `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`)
- Create: `server/tsconfig.json`, `server/src/core.ts`, `server/src/types.ts`, `server/test/memoryStore.ts`
- Modify: root `package.json` `jest.testPathIgnorePatterns` to add `<rootDir>/server/`; root `tsconfig.json` `exclude` to add `server`
- Test: `server/test/routes.test.ts`

**Interfaces:**
- Produces in `types.ts`:
  - `Install { id: string; secretHash: string; endpoint: string; p256dh: string; auth: string; touchedAt: number }`;
  - `Reminder { rid: string; dueAt: number; kind: Kind }`;
  - `Kind = 'dose' | 'dose_final' | 'bedtime' | 'other' | 'keep'`;
  - `Store { getInstall(id: string): Promise<Install | null>; putInstall(i: Install): Promise<void>; replaceReminders(id: string, list: Reminder[]): Promise<void>; deleteInstall(id: string): Promise<void>; due(now: number, limit: number): Promise<(Reminder & { installId: string })[]>; deleteReminder(installId: string, rid: string): Promise<void>; staleInstalls(before: number): Promise<string[]>; countHit(key: string, windowStart: number): Promise<number> }`.
- Produces in `core.ts`: `handle(req: Request, deps: { store: Store; now: number; allowedOrigin: string }): Promise<Response>`, with these routes:
  - `PUT /v1/install`, body `{ id, secret, subscription: { endpoint, keys: { p256dh, auth } } }`;
  - `PUT /v1/install/reminders`, body `{ reminders: { id, dueAt, kind }[] }` (`dueAt` is an ISO string);
  - `DELETE /v1/install`;
  - `OPTIONS` preflight.

  Auth is `Authorization: Bearer <id>.<secret>`. `id` is base64url, 22 characters, and `secret` is base64url, 43 characters. The secret is stored as a SHA-256 hash.

- [ ] **Step 1: Write the failing tests**

Use `memoryStore()` and `deps = { store, now: Date.parse('2026-11-01T08:00:00Z'), allowedOrigin: 'https://steady.example' }`. Each test sends a `new Request(...)` with `Origin: https://steady.example`.

- `registers an install and refuses the same id with another secret`: the first PUT gives 204; the same id with a different secret gives 403.
- `replaces reminders and keeps only id, due time and kind`: the body's reminders carry an extra `body: 'robin, a small mark…'`. The store receives `[{ rid, dueAt: <ms>, kind: 'dose' }]` only. Assert `JSON.stringify(store.dump())` doesn't contain `robin`.
- `refuses more than 60 reminders`: 61 gives 413.
- `refuses unknown kinds and due times outside 1 h ago to 14 days ahead`: 400.
- `needs the right bearer`: none or wrong gives 401.
- `answers only the Steady web app's origin`: another `Origin` gives 403, with no `Access-Control-Allow-Origin`. The allowed origin echoes it back.
- `rate-limits writes`: the 31st PUT within a minute for one install gives 429.
- `deletes an install and its reminders`: DELETE gives 204, and the store is empty for that id.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd server && npm install && npm test`
Expected: FAIL, because `handle` isn't defined.

- [ ] **Step 3: Implement `core.ts`, `types.ts` and `memoryStore.ts`**

Use Web Crypto `crypto.subtle.digest('SHA-256', …)` for secret hashes, compared in constant time. Rate limiting uses `countHit` in 60 s windows, keyed `i:<id>` and `ip:<CF-Connecting-IP>`.

- [ ] **Step 4: Run them and confirm they pass**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server package.json tsconfig.json
git commit -m "Reminder server: routes that keep only ids and times"
```

### Task 2: Sending due reminders

**Files:**
- Create: `server/src/send.ts`, `server/src/index.ts` (Worker entry: `fetch` calls `handle` with a D1 store; `scheduled` calls `runDue`), `server/src/d1Store.ts`, `server/src/webPush.ts`
- Test: `server/test/send.test.ts`

**Interfaces:**
- Produces:
  - `PushSender { send(target: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<'sent' | 'gone' | 'failed'> }`;
  - `runDue(deps: { store: Store; sender: PushSender; now: number; batch?: number }): Promise<{ sent: number; gone: number; dropped: number }>`, with a default batch of 50;
  - `webPushSender(env: { VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string }): PushSender`, built on a Workers-compatible Web Push library (the builder's choice, per the spec).

- [ ] **Step 1: Write the failing tests**

Each uses a `memoryStore` and a fake sender that records calls.

- `sends what is due with only its id, then forgets it`: one reminder due now and one in 5 minutes. One call, payload `'{"id":"<rid>"}'`. The due one is deleted and the later one is kept.
- `deletes an install whose push address is gone`: the sender returns `gone`, so `getInstall` gives null afterwards.
- `retries a failed send for up to 10 minutes, then drops it`: `failed` at due+0 is kept. At due+11 min it's deleted and counted in `dropped`.
- `sends at most a batch per run`: with 60 due and batch 50, there are 50 calls.
- `clears installs with no reminders and no contact for 30 days`: one old empty install is deleted, and a fresh one is kept.

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd server && npm test`
Expected: FAIL, because `runDue` isn't defined.

- [ ] **Step 3: Implement `send.ts`, `d1Store.ts`, `webPush.ts` and `index.ts`**

`index.ts` reads `env.DB`, `env.ALLOWED_ORIGIN` and the VAPID vars. `scheduled` uses `ctx.waitUntil(runDue(...))` and logs only counts.

- [ ] **Step 4: Run them and confirm they pass**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server
git commit -m "Reminder server: send due reminders every minute"
```

### Task 3: Deploy the server (needs the owner)

**Files:**
- Create: `server/wrangler.toml`. It sets:
  - `name = "steady-reminders"` and `main = "src/index.ts"`;
  - one `[[d1_databases]]` binding `DB`;
  - `[triggers] crons = ["* * * * *"]`;
  - `[vars]` `ALLOWED_ORIGIN` (the Vercel production URL from plan 2) and `VAPID_SUBJECT` (the same URL).
- Create: `server/migrations/0001_init.sql` (tables `installs`, `reminders` with primary key `(install_id, rid)` and an index on `due_at`, and `hits`), `server/scripts/vapid-keys.mjs` (it prints only the private key to stdout and writes the public key to `server/vapid-public.txt`)

- [ ] **Step 1: The owner creates the Cloudflare account and signs in**

Ask in chat: create a free account at dash.cloudflare.com, then run `npx wrangler login` in a terminal tab here. It opens a browser to approve. Never handle their password or a token.

- [ ] **Step 2: Create the database, apply the migration, set the key, deploy**

Run, in `server/`:
1. `npx wrangler d1 create steady-reminders`, putting the returned id into `wrangler.toml`.
2. `npx wrangler d1 migrations apply steady-reminders --remote`.
3. `node scripts/vapid-keys.mjs | npx wrangler secret put VAPID_PRIVATE_KEY`.
4. `npx wrangler secret put VAPID_PUBLIC_KEY < vapid-public.txt`.
5. `npx wrangler deploy`.

Expected: the deploy prints `https://steady-reminders.<account>.workers.dev`, and `curl -i -X OPTIONS -H "Origin: <vercel url>" <worker>/v1/install` returns 204 with that origin.

- [ ] **Step 3: Commit**

```bash
git add server/wrangler.toml server/migrations server/scripts server/vapid-public.txt
git commit -m "Reminder server: Cloudflare config"
```

### Task 4: The phone side: identity, store and the web port

**Files:**
- Create:
  - `src/notify/web/kv.ts`: `Kv`, `idbKv()` (database `steady-web`, store `kv`, the same names the service worker reads) and `memoryKv()`;
  - `src/notify/web/identity.ts`, `src/notify/web/ids.ts`, `src/notify/web/api.ts`;
  - `src/notify/web/config.ts`: `PUSH_URL` and `VAPID_PUBLIC_KEY` from `process.env.EXPO_PUBLIC_PUSH_URL` and `EXPO_PUBLIC_VAPID_PUBLIC_KEY`;
  - `src/notify/web/webPushPort.ts`.
- Modify: `src/notify/copy.ts` (add `WEB_COPY = { allMarked, neutral, keepComing }`, with the Global Constraints wording)
- Test: `src/notify/web/__tests__/webPushPort.test.ts`, `src/notify/__tests__/copy.test.ts` (`WEB_COPY` follows the same rules)

**Interfaces:**
- Consumes: `NotificationPort` and `Planned` (`src/notify/scheduler.ts`, `src/notify/plan.ts`).
- Produces:
  - `Kv { get<T>(k: string): Promise<T | undefined>; set(k: string, v: unknown): Promise<void>; del(k: string): Promise<void>; keys(prefix: string): Promise<string[]> }`;
  - `getIdentity(kv: Kv): Promise<{ id: string; secret: string }>`;
  - `opaqueId(secret: string, plannedId: string): Promise<string>`;
  - `createApi(baseUrl: string, f?: typeof fetch): { putInstall(me, sub: PushSubscriptionJSON): Promise<void>; putReminders(me, list: { id: string; dueAt: string; kind: string }[]): Promise<void>; deleteInstall(me): Promise<void> }`;
  - `createWebPushPort(deps: { kv: Kv; api: ReturnType<typeof createApi>; permitted: () => Promise<boolean>; notifications?: () => Promise<{ data?: unknown; close(): void }[]> }): NotificationPort & { flush(): Promise<void> }`.
- Local records (read by the service worker in Task 5):
  - `rem:<opaque>` holds `{ plannedId, body, fireAt, kind, doseIds }`;
  - `tomb:<opaque>` holds `{ at }`, pruned after 24 h;
  - `pending` holds `true` while the server list is out of date.

- [ ] **Step 1: Write the failing tests**

Use `memoryKv()`, a fake api that records calls, and a sample `Planned` with body `'robin, a small mark when you\'re ready.'`, id `'dose:2026-11-01T08:00:00.000Z:0'` and `data.doseIds: ['d-1']`.

- `keeps the words on the phone and sends the server only an opaque id, time and kind`: after `schedule` and `flush`, the api received one list whose entry `id` isn't the planned id, is 22 characters, and whose `kind` is `'dose'`. `JSON.stringify(api.calls)` contains none of `robin`, the planned id or `d-1`.
- `answers scheduled() with what diffSchedule expects`: the round trip of `{ id, fireAt, body }` equals the planned one.
- `remembers a cancelled reminder for the service worker`: after `cancel`, `tomb:<opaque>` exists, `rem:` doesn't, and the next server list omits it.
- `keeps changes pending when the server can't be reached, and sends them later`: an api that throws leaves `pending` true, and the next `flush` with a working api sends the list.
- `adds one keep-coming notice an hour after the last reminder`: with reminders at 08:00 and 20:00, the list has exactly one `keep` entry at 21:00. After rescheduling to 22:00, it's at 23:00, still only one.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/notify/web src/notify/__tests__/copy.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

Map `Planned.category` to the server kind: `'dose'` / `'dose_final'` / `'bedtime'`, with `null` becoming `'other'`. `flush()` builds the full list from `rem:*` plus the keep notice, which is stored as `rem:<opaque>` with body `WEB_COPY.keepComing` so the service worker can show it. Then it calls `putReminders` and clears `pending`.

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx jest src/notify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/notify
git commit -m "Web reminders: a port that keeps the words on the phone"
```

### Task 5: The service worker shows the reminder

**Files:**
- Create: `public/sw-push.js`. It holds the pure `pushNotice(rec, tomb)` and the same three strings as `WEB_COPY`. It works both as `importScripts` and as `module.exports`.
- Modify: `public/sw.js`. It does `importScripts('/sw-push.js')` and handles:
  - `push`: read `{ id }`, look up `rem:<id>` and `tomb:<id>` in IndexedDB (`steady-web`/`kv`), then `showNotification('Steady', { body, tag: id, data: { doseIds } })`;
  - `notificationclick`: focus an open Steady window, or open `/home`.
- Test: `src/notify/web/__tests__/swPush.test.ts`

**Interfaces:**
- Produces: `pushNotice(rec?: { body: string; doseIds?: string[] }, tomb?: { at: number }): { body: string; doseIds: string[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
const { pushNotice, STRINGS } = require('../../../../public/sw-push.js');
import { WEB_COPY } from '../../copy';

it('shows the reminder in its own words', () => expect(pushNotice({ body: 'still here.', doseIds: ['d'] }).body).toBe('still here.'));
it('says all marked for a reminder cancelled on this phone', () => expect(pushNotice(undefined, { at: 1 }).body).toBe(WEB_COPY.allMarked));
it('falls back to the neutral line for an unknown id', () => expect(pushNotice().body).toBe(WEB_COPY.neutral));
it('uses the same words as the app', () => expect(STRINGS).toEqual(WEB_COPY));
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/notify/web/__tests__/swPush.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `sw-push.js` and the `sw.js` handlers**

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx jest src/notify/web/__tests__/swPush.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/sw-push.js public/sw.js src/notify/web/__tests__/swPush.test.ts
git commit -m "Web reminders: the service worker shows them"
```

### Task 6: Wire it into the app

**Files:**
- Create:
  - `src/notify/web/turnOn.ts`: `turnOnReminders(): Promise<'on' | 'denied' | 'unsupported' | 'not-installed'>`. It says `not-installed` on iPhone when not standalone. Otherwise it calls `Notification.requestPermission()`, then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, then `putInstall`, then `flush`.
  - `src/notify/web/forget.ts`: `forgetReminders(): Promise<void>`. It calls `deleteInstall`, ignoring network errors, then clears every kv key.
- Modify:
  - `src/notify/port.web.ts`: `activePort` is `createWebPushPort(...)`. `syncSoon` uses the same debounce as `expoPort.syncSoon`, then `flush`. `setupNotifications` registers the service worker, flushes, and flushes again on the window's `online` event.
  - `src/notify/port.ts` exports `forgetReminders(): Promise<void>`, a no-op on native. `port.web.ts` re-exports the real one from `./web/forget`. Settings imports it from `src/notify/port`.
  - The three general privacy lines get a web-only wording (`Platform.OS === 'web'`). The support-condition lines stay as they are, because conditions never leave the phone.
    - `app/onboarding/index.tsx:28`: "No account. No email. Only your reminder times leave this phone."
    - `app/onboarding/legal.tsx:44`: "Everything else stays on this phone. You can export it or delete it any time in Settings."
    - `app/(tabs)/settings.tsx:271`: "Everything stays on this phone except your reminder times. No account, no tracking."
  - `src/notify/NotificationBridge.web.tsx`: calls `setupNotifications()` on mount.
  - `app/onboarding/notifications.tsx`, on the web only:
    - the caption reads "To remind you, steady's server keeps only when your reminders are due. never your name, meds or moods.";
    - the example shows no Taken or Snooze buttons;
    - Continue calls `turnOnReminders()`, then moves on whatever it returns.
  - `app/(tabs)/settings.tsx`, on the web only:
    - a Reminders row with its state, and "Turn on reminders" when off (a tap, as iOS requires);
    - the same privacy sentence;
    - Delete everything also calls `forgetReminders()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/notify/web/__tests__/forget.test.ts
it('deletes the server record and leaves nothing on the phone', async () => {
  const kv = memoryKv(); await kv.set('rem:x', {}); await kv.set('pending', true);
  const api = fakeApi();
  await forgetRemindersWith({ kv, api, me: { id: 'i', secret: 's' } });
  expect(api.calls.map((c) => c.name)).toEqual(['deleteInstall']);
  expect(await kv.keys('')).toEqual([]);
});
```

(`forget.ts` exports `forgetRemindersWith(deps)`, which `forgetReminders()` calls with the real kv, api and identity.)

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/notify/web/__tests__/forget.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement everything in Files**

- [ ] **Step 4: Run it and confirm it passes, plus the full checks**

Run: `npm test; npm run lint; npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Set the web build's config on Vercel and deploy**

Set the production env vars on project `steady`: `EXPO_PUBLIC_PUSH_URL` (the Worker URL) and `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (the contents of `server/vapid-public.txt`). Use the Vercel tools. Then push `main`.

```bash
git add src app
git commit -m "Web reminders: turn on, sync, forget"
git push origin main
```

Expected: the new deploy is live, and `/` loads with no console errors.

### Task 7: End to end, then tell people

**Files:**
- Modify: `README.md` (only after Step 2)

- [ ] **Step 1: A desktop browser check**

In a desktop Chrome or Edge that allows notifications, install the web app, set it up with a dose 3 minutes ahead, and turn on reminders.

Expected:
- the reminder arrives within a minute of the time, with the app's words;
- marking the dose before a follow-up means no further reminder;
- `npx wrangler d1 execute steady-reminders --remote --command "select rid, due_at, kind from reminders"` shows only opaque ids, times and kinds;
- Delete everything empties that install's rows.

- [ ] **Step 2: The owner's iPhone check**

Ask the owner to do this on an iPhone:
1. Install from Safari and set up.
2. Turn on reminders.
3. Set a dose 5 minutes ahead and lock the phone.

Expected:
- the reminder arrives;
- tapping it opens Steady on Home;
- marking stops the follow-ups;
- it's all still there the next day.

- [ ] **Step 3: Add the iPhone line to the README and push (only after the owner confirms Step 2)**

Under "Download for Android", add: **On iPhone:** open `<production URL>` in Safari, tap Share, then Add to Home Screen.

```bash
git add README.md
git commit -m "README: install Steady on iPhone from Safari"
git push origin main
```
