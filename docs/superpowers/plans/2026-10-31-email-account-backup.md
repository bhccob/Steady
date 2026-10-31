# Email Account and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional sign-in with an email code, and a backup of everything on Steady's server, so that signing in on a new phone or browser brings it all back.

**Architecture:**
- **Server:** new `/v1/account/*` routes in the existing Worker `steady-reminders` (`server/`, D1). They cover codes sent through Resend, sessions, and one encrypted, gzipped backup per account (plus the one before). The Worker also answers on `api.steadyapp.cc`.
- **App:** `src/account/` holds the client, the session storage, the restore and the automatic backup. The screens are new routes in `app/account/`. The welcome screen and Settings link into them. Reminders, scoring and the no-account path are untouched.

**Tech Stack:**
- Server: Cloudflare Workers + D1, WebCrypto (AES-GCM, HMAC-SHA256), `CompressionStream`, Resend's HTTP API, Vitest.
- App: Expo SDK 58, expo-router, expo-sqlite, `expo-secure-store` (new, Android), IndexedDB (web), zustand, Jest.

**Spec:** `docs/superpowers/specs/2026-10-30-email-account-backup-design.md`, approved 31 October 2026. Mockup: `.superpowers/brainstorm/59055-1793374256/content/account-signup-v3.html` (git-ignored; it lives in the owner's checkout).

## Global Constraints

- **The only way to sign in** is an email address, then a 6-digit code. No passwords, no Google or Apple, no recovery code.
- **Codes:**
  - A code works for 10 minutes and for 5 tries.
  - "Send a new code" is allowed after 30 seconds.
  - Each address can get at most 5 codes an hour.
- **The account is optional.** "Start without an account" on the welcome screen leads into today's setup, unchanged. Without an account, nothing new leaves the device.
- **Backups start only once setup is complete** (a `profile` row exists, so 18+ is confirmed). Before that, nothing is uploaded.
- **The server never stores an email address in plain text.** It keeps `emailHash = HMAC-SHA256(ACCOUNT_KEY, "email|" + normalised email)`, where normalised means trimmed and lowercased.
- **Codes and session tokens are stored hashed.** Tokens are 32 random bytes, base64url (43 characters).
- **Backups are stored encrypted at rest:** gzip, then AES-GCM-256 with `BACKUP_KEY`, a random 12-byte IV, and the account id as additional data. The server keeps the latest backup in slot 0 and the one before it in slot 1. The largest accepted body is 10 MB of JSON (413 above that).
- **One device at a time.** Only the account's active device may save a backup (409 `other-device` otherwise). Signing in and then restoring, or choosing "Keep this phone's data", makes that device active.
- **Origin rule for `/v1/account/*`:** a request with no `Origin` (the Android app) or `Origin` = `ALLOWED_ORIGIN` is served. Any other origin gets 403. The reminder routes keep their rule (`Origin` must equal `ALLOWED_ORIGIN`).
- **Emails:**
  - From `Steady <sign-in@steadyapp.cc>`, plain text only. They never mention pills, moods or health.
  - Code email subject: `Your Steady code: 482931`. Body: `Your Steady sign-in code is 482931. It works for 10 minutes. If you didn't ask for it, you can ignore this email.`
  - New-device email subject: `New sign-in to Steady`. Body: `You signed in to Steady on a new device. If this wasn't you, open Steady on your phone and choose Sign out everywhere in Settings.`
- **Copy (exact):**
  - "Continue with email"
  - "Start without an account"
  - Welcome note with an account: "With an account, Steady keeps a private backup so you can pick up on a new phone."
  - "What's your email?" with the subtitle "We'll send you a 6-digit code. No password to remember."
  - "Send my code", "Check your email", "Send a new code", "Use a different email"
  - "Welcome back, {name}." (falls back to "Welcome back." when the name is blank)
  - "Use your backup", "Keep this phone's data"
  - Settings section title "Account"; rows "Backup", "Sign out", "Sign out everywhere", "Delete my account"
  - "Back up with email"
  - "Your backup is now on another device"
- **Honest wording:**
  - Without an account, the old notes stay word for word.
  - When signed in, the Settings line under Reminders reads "You're signed in, so Steady's server also keeps your backup." It replaces "Never your name, pills or moods.", which stays for everyone else.
- **Privacy page:**
  - Lives at `public/privacy.html`. It names **Steady**, with contact **privacy@steadyapp.cc**.
  - It says what is stored: the email fingerprint, the backup and sign-in times. It also says where (Cloudflare), that Resend delivers the emails, and how to delete.
- **Words:** "pill", never "med" or "medication" (except the existing safety line).
- **Unchanged:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm --prefix server test`, reminders, and every screen for people who never sign in.
- **Owner-only steps:** deploying the Worker, applying the D1 migration remotely, adding the custom domain and setting secrets touch the owner's Cloudflare account. Stop and ask before each. Never print a secret: generate it and pipe it straight into `wrangler secret put`.

## Review Focus

1. **A pasted code with spaces or a dash** ("482 931", "482-931") must fill all six boxes. Pinned by Task 6 (`digitsFromPaste`).
2. **The same email typed differently** (" Sam@Example.com ") must reach the same account. Pinned by Task 2 (normalisation).
3. **The network dropping during restore,** or bad data in a backup, must leave the device's data as it was. Pinned by Task 5 (`importData` all-or-nothing).
4. **The old phone saving after the new phone took over** must get 409 and show "Your backup is now on another device", never overwrite. Pinned by Task 3 (409) and Task 7 (state `elsewhere`).
5. **A year of history** (about 2,000 doses) must fit, upload and come back intact. Pinned by Task 3 (a large body round-trips) and Task 5 (round trip).

---

### Task 1: Account storage on the server

**Files:**
- Create: `server/migrations/0002_accounts.sql`, `server/src/accountTypes.ts`, `server/src/d1AccountStore.ts`, `server/test/memoryAccountStore.ts`
- Test: `server/test/accountStore.test.ts`

**Interfaces:**
- Produces in `accountTypes.ts`:
  - `Account { id: string; emailHash: string; activeDevice: string | null; createdAt: number }`
  - `LoginCode { emailHash: string; codeHash: string; expiresAt: number; tries: number; sentAt: number }`
  - `Session { tokenHash: string; accountId: string; deviceId: string; createdAt: number; lastSeen: number }`
  - `StoredBackup { accountId: string; slot: 0 | 1; deviceId: string; savedAt: number; schemaVersion: number; iv: string; body: string }`: `iv` and `body` are base64.
  - `AccountStore` with:
    - `accountByEmail(emailHash) → Account | null`, `createAccount(a)`, `setActiveDevice(accountId, deviceId)`, `deleteAccount(accountId)`. Deleting removes sessions, backups and known devices too.
    - `putCode(c)`, `getCode(emailHash)`, `bumpTries(emailHash)`, `deleteCode(emailHash)`.
    - `codesSentSince(emailHash, since) → number`, `noteCodeSent(emailHash, at)`.
    - `createSession(s)`, `sessionByToken(tokenHash) → (Session & { account: Account }) | null`, `touchSession(tokenHash, at)`, `deleteSession(tokenHash)`, `deleteSessions(accountId)`.
    - `knowsDevice(accountId, deviceId) → boolean`, `noteDevice(accountId, deviceId)`.
    - `putBackup(b)`: moves slot 0 to slot 1, then writes slot 0. `getBackup(accountId, slot) → StoredBackup | null`.
- Tables (`0002_accounts.sql`):
  - `accounts(id PK, email_hash UNIQUE, active_device, created_at)`
  - `login_codes(email_hash PK, code_hash, expires_at, tries, sent_at)`
  - `code_sends(email_hash, sent_at)`
  - `sessions(token_hash PK, account_id, device_id, created_at, last_seen)`
  - `known_devices(account_id, device_id, PK both)`
  - `backups(account_id, slot, device_id, saved_at, schema_version, iv, body, PK(account_id, slot))`

- [ ] **Step 1: Write the failing tests** against `memoryAccountStore()` (which implements `AccountStore` plus `dump()`):
  - `it('keeps the latest backup in slot 0 and the one before in slot 1')`: put three backups (`savedAt` 1, 2, 3). `getBackup(id, 0).savedAt` is 3 and `getBackup(id, 1).savedAt` is 2.
  - `it('deleting an account removes its sessions, backups, devices and nothing else')`: two accounts. Delete one; the other's session and backup remain, and `dump()` holds no row with the deleted id.
- [ ] **Step 2:** `npm --prefix server test -- accountStore`. Expected: FAIL, module not found.
- [ ] **Step 3:** Write `accountTypes.ts`, `memoryAccountStore.ts`, the migration and `d1AccountStore(db: D1Database): AccountStore`. Follow `d1Store.ts`: `db.batch` for the slot move and for deletes.
- [ ] **Step 4:** `npm --prefix server test`. Expected: all pass, including the 16 existing tests.
- [ ] **Step 5:** Commit: `Account storage for the server: accounts, codes, sessions, backups`.

### Task 2: Codes and signing in

**Files:**
- Create: `server/src/account.ts` (routes), `server/src/mail.ts` (`Mailer`, `resendMailer`)
- Modify: `server/src/core.ts`: before the Origin check, send `/v1/account*` paths to `handleAccount`. Export `sha256` and `hmac`.
- Test: `server/test/account.test.ts`

**Interfaces:**
- Consumes: `AccountStore` (Task 1).
- Produces:
  - `Mailer { send(to: string, subject: string, text: string): Promise<boolean> }`.
  - `resendMailer(apiKey: string, from: string, f = fetch): Mailer`: `POST https://api.resend.com/emails` with `{ from, to, subject, text }`, Bearer auth.
  - `AccountDeps { store: AccountStore; mailer: Mailer; now: number; allowedOrigin: string; ipKey: string; accountKey: string; backupKey: string }`
  - `handleAccount(req: Request, deps: AccountDeps): Promise<Response>`
  - `normaliseEmail(s: string): string | null`: trims and lowercases. It returns null unless the result matches `^[^\s@]+@[^\s@]+\.[^\s@]+$` and is at most 254 characters.
- Routes (JSON bodies; CORS headers as in `core.ts`, methods `GET, POST, PUT, DELETE, OPTIONS`):
  - `POST /v1/account/code {email, consent: true}`:
    - Answers 204 whether or not the account exists.
    - 400 for a bad email or missing consent. 429 inside 30 s of the last code, or after 5 codes in the hour.
    - Sends the code email.
  - `POST /v1/account/session {email, code, deviceId}`, where `deviceId` is 22 base64url characters:
    - A right code returns 200 `{ token, isNew, hasBackup, savedAt: number | null }` and deletes the code.
    - A wrong code returns 401 and counts a try. After 5 tries, or once expired, the code is gone (401 `{ reason: 'code-expired' }`).
    - It creates the account on first sign-in.
    - For an existing account, a device it doesn't know triggers the new-device email. Then the device is noted.

- [ ] **Step 1: Write the failing tests** with `memoryAccountStore` and a fake mailer that records `{to, subject, text}`:
  - `it('sends a 6-digit code and answers the same for new and known emails')`
  - `it('treats " Sam@Example.com " and "sam@example.com" as one account')`: sign in twice with the two spellings, and `dump()` has one account.
  - `it('never stores the email address')`: `JSON.stringify(dump())` does not contain `sam@example.com` or `Sam@Example.com`.
  - `it('refuses a second code within 30 s and a sixth within the hour')`: 429.
  - `it('signs in with the right code once, and refuses it after 5 wrong tries or after 10 minutes')`
  - `it('emails about a new device only for an account that already had one')`: the first sign-in sends no alert. A second device sends `New sign-in to Steady`. The same second device again sends nothing.
  - `it('serves the Android app (no Origin) and the web app, and refuses other origins')`: the account route answers with no Origin and with `ALLOWED_ORIGIN`, and gives 403 for `https://evil.example`. `PUT /v1/install` with no Origin is still 403.
  - `it('keeps health words out of every email')`: across all sent emails, none of `pill`, `mood`, `med`.
  - `it('rate-limits account requests per address')`: request 121 in one minute from one address gets 429.
- [ ] **Step 2:** `npm --prefix server test -- account`. Expected: FAIL, `handleAccount` not found.
- [ ] **Step 3:** `handleAccount` first counts the request against the same per-address limit as `core.ts`: `REQUESTS_PER_IP`, keyed `ip:` + the hashed address and minute. 429 over it. Then implement the code, the hashes and the tokens:
  - Code: `crypto.getRandomValues` with rejection sampling, padded to 6 digits.
  - Code hash: `hmac(accountKey, "code|" + emailHash + "|" + code)`.
  - Token: 32 random bytes; store `sha256(token)`.
  - Compare hashes with `sameHash`.
- [ ] **Step 4:** `npm --prefix server test`. Expected: all pass.
- [ ] **Step 5:** Commit: `Sign in with an email code: code and session routes, Resend mailer`.

### Task 3: Backup, devices, sign-out and delete on the server

**Files:**
- Create: `server/src/seal.ts` (`seal`, `open`)
- Modify: `server/src/account.ts`
- Test: `server/test/backup.test.ts`

**Interfaces:**
- Produces:
  - `seal(key: string, accountId: string, json: string): Promise<{ iv: string; body: string }>`: gzip, then AES-GCM. `key` is 32 bytes base64url.
  - `open(key: string, accountId: string, sealed: { iv: string; body: string }): Promise<string>`: throws on a wrong account or on tampering.
- Routes, all with `Authorization: Bearer <token>` (401 when unknown):
  - `GET /v1/account` → `{ active: boolean, savedAt: number | null }`
  - `GET /v1/account/backup` → 200 `{ savedAt, schemaVersion, data }`, or 404 when there is none.
  - `PUT /v1/account/backup {schemaVersion, data}`:
    - 204 when saved, then `savedAt = now`.
    - 409 `{ reason: 'other-device' }` when this session's device isn't active, or when no device is active yet.
    - 413 above 10 MB.
  - `POST /v1/account/claim` makes this device active (204).
  - `DELETE /v1/account/session` signs out this device.
  - `DELETE /v1/account/sessions` signs out every device.
  - `DELETE /v1/account` deletes everything.

- [ ] **Step 1: Write the failing tests:**
  - `it('stores a backup that a copied database cannot read')`: put `data` containing the string `robin-pill-marker`. `JSON.stringify(dump())` doesn't contain it; `GET` returns it.
  - `it('round-trips a year of history')`: a body with 2,000 dose rows comes back deep-equal.
  - `it('refuses a body over 10 MB')`: 413.
  - `it('refuses a backup from a device that is not the active one, until it claims')`: device A claims and saves. Device B signs in, so A is still active. B's PUT gets 409. B claims, and then A's PUT gets 409.
  - `it('signs out one device, then every device')`
  - `it('deletes the account and its backups, and the old token stops working')`
  - `it('cannot open a backup sealed for another account')`: `open` with another account id throws.
- [ ] **Step 2:** `npm --prefix server test -- backup`. Expected: FAIL.
- [ ] **Step 3:** Implement `seal.ts` and the routes. Use `CompressionStream('gzip')` and `DecompressionStream`. Turn the body into JSON text once: its length is the size check.
- [ ] **Step 4:** `npm --prefix server test` and `npm --prefix server run typecheck`. Expected: all pass, clean.
- [ ] **Step 5:** Commit: `Encrypted backups, one device at a time, sign out and delete`.

### Task 4: Wire up the Worker and put it online (needs the owner)

**Files:**
- Modify: `server/src/index.ts`:
  - `Env` gains `RESEND_API_KEY`, `ACCOUNT_KEY`, `BACKUP_KEY` (secrets), `MAIL_FROM` (var) and an optional `MAIL_MODE` (var).
  - `fetch` builds `AccountDeps` with `resendMailer(env.RESEND_API_KEY, env.MAIL_FROM)`.
  - Only when `MAIL_MODE === 'log'` does it use `logMailer()` instead, which `console.log`s the email for local testing. `MAIL_MODE` is never set in `wrangler.toml`, only on the `wrangler dev` command line, so production can't log a code. If `RESEND_API_KEY` is missing and `MAIL_MODE` isn't `log`, code requests answer 503.
- Create: `server/.dev.vars` (already git-ignored) with local random `ACCOUNT_KEY` and `BACKUP_KEY` for `wrangler dev`. Write it with `random-key.mjs`, and never print it.
  - `scheduled` also deletes expired codes and code sends older than an hour.
- Modify: `server/wrangler.toml`:
  - `MAIL_FROM = "Steady <sign-in@steadyapp.cc>"`
  - `routes = [{ pattern = "api.steadyapp.cc", custom_domain = true }]`
- Create: `server/scripts/random-key.mjs`: prints 32 random bytes as base64url and nothing else.

- [ ] **Step 1:** `npm --prefix server run typecheck && npm --prefix server test`. Expected: clean, all pass.
- [ ] **Step 2: Ask the owner,** then run from `server/`:
  - `node scripts/random-key.mjs | npx wrangler secret put ACCOUNT_KEY`
  - `node scripts/random-key.mjs | npx wrangler secret put BACKUP_KEY`
  - Expected: two `Success!` lines, no key shown. `RESEND_API_KEY` is already set (31 October).
- [ ] **Step 3: Ask the owner,** then run `npx wrangler d1 migrations apply steady-reminders --remote`. Expected: `0002_accounts.sql` applied.
- [ ] **Step 4: Ask the owner,** then run `npx wrangler deploy`. Expected: both `steady-reminders.<sub>.workers.dev` and `api.steadyapp.cc` listed.
- [ ] **Step 5: Smoke test:** `POST https://api.steadyapp.cc/v1/account/code` with the owner's own email and `consent: true` gives 204. The owner confirms the email arrived, from `sign-in@steadyapp.cc`. Nothing else is sent.
- [ ] **Step 6:** Commit: `Server: account routes online at api.steadyapp.cc`.

### Task 5: Restore on the device

**Files:**
- Modify: `src/settings/data.ts`
- Test: `src/settings/__tests__/data.test.ts`

**Interfaces:**
- Produces:
  - `importData(db: Db, backup: SteadyExport): Promise<void>`
  - `class NewerBackupError extends Error`
- Behaviour:
  - It throws `NewerBackupError` when `backup.schemaVersion` is greater than the device's `user_version`.
  - Otherwise, in one transaction, it empties every table in `TABLES` (in reverse order), then inserts each row. Only columns the device's table has are used (read with `PRAGMA table_info`), so an older backup still fits.
  - Any failure rolls everything back.

- [ ] **Step 1: Write the failing tests** with `createTestDb` and the seed helpers used in `data.test.ts`:
  - `it('restores an export exactly')`: seed, export, change data, import the export, export again. `tables` are deep-equal.
  - `it('keeps the device data when a backup row is bad')`: a backup with a `doses` row missing `med_id` makes import throw. The device's own export before and after is deep-equal.
  - `it('refuses a backup from a newer version of Steady')`: `schemaVersion: 999` throws `NewerBackupError`, and the data is unchanged.
  - `it('restores an older backup that lacks a newer column')`: drop a column name from every `meds` row. The import works, and the column has its default.
  - `it('round-trips a year of doses')`: 2,000 doses.
- [ ] **Step 2:** `npx jest src/settings/__tests__/data.test.ts`. Expected: FAIL, `importData` not exported.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** `npx jest src/settings`. Expected: PASS.
- [ ] **Step 5:** Commit: `Restore: import a backup all or nothing`.

### Task 6: The account client on the device

**Files:**
- Create:
  - `src/account/config.ts`: `ACCOUNT_URL = process.env.EXPO_PUBLIC_ACCOUNT_URL || 'https://api.steadyapp.cc'`
  - `src/account/api.ts`, `src/account/session.ts`, `src/account/session.web.ts`, `src/account/input.ts`, `src/account/next.ts`
- Modify: `package.json` with `npx expo install expo-secure-store`.
- Test: `src/account/__tests__/api.test.ts`, `input.test.ts`, `next.test.ts`

**Interfaces:**
- Produces:
  - `api.ts`: `createAccountApi(baseUrl: string, f: typeof fetch = fetch)` with:
    - `requestCode(email)`
    - `signIn(email, code, deviceId) → { token, isNew, hasBackup, savedAt }`
    - `status(token) → { active, savedAt }`
    - `getBackup(token) → { savedAt, schemaVersion, data: SteadyExport } | null`
    - `putBackup(token, backup: SteadyExport)`: sends `{ schemaVersion: backup.schemaVersion, data: backup }`.
    - `claim(token)`, `signOut(token)`, `signOutEverywhere(token)`, `deleteAccount(token)`

    Non-2xx throws `AccountError { status: number; reason?: string }`.
  - `session.ts` (expo-secure-store) and `session.web.ts` (`idbKv()` key `account`):
    - `loadSession(): Promise<AccountSession | null>`, `saveSession(s)`, `clearSession()`
    - `deviceId(): Promise<string>`: 22 base64url characters, made once, kept after sign-out.

    `AccountSession { token: string; email: string; savedAt: number | null }`.
  - `input.ts`:
    - `digitsFromPaste(text: string): string`: keeps digits, up to 6.
    - `looksLikeEmail(text: string): boolean`: the same rule as the server's `normaliseEmail`.
  - `next.ts`: `afterSignIn(r: { isNew: boolean; hasBackup: boolean }, deviceHasData: boolean): 'setup' | 'restore' | 'choose' | 'claim'`
    - no backup and no data → `'setup'`
    - backup and no data → `'restore'`
    - backup and data → `'choose'`
    - no backup and data → `'claim'`

- [ ] **Step 1: Write the failing tests:**
  - `digitsFromPaste('482 931')`, `('482-931')` and `('Your code: 482931.')` each give `'482931'`. `('12')` gives `'12'`.
  - `looksLikeEmail(' Sam@Example.com ')` is true. `'sam@'`, `'sam example.com'` and `''` are false.
  - `afterSignIn`: all four cases.
  - The api with a fake fetch:
    - it sends `Authorization: Bearer <token>`;
    - `409 {reason:'other-device'}` throws `AccountError` with `reason: 'other-device'`;
    - `signIn` posts `{ email, code, deviceId }` to `/v1/account/session`;
    - `requestCode` posts `consent: true`.
- [ ] **Step 2:** `npx jest src/account`. Expected: FAIL.
- [ ] **Step 3:** Implement. `session.ts` uses `SecureStore.setItemAsync('steady.account', JSON)`.
- [ ] **Step 4:** `npx jest src/account && npx tsc --noEmit`. Expected: PASS, clean.
- [ ] **Step 5:** Commit: `Account client: api, session storage, code and email input, next step after sign-in`.

### Task 7: Backing up by itself

**Files:**
- Create: `src/account/autoBackup.ts` (logic), `src/account/AccountBridge.tsx` (mounted in `app/_layout.tsx` next to `NotificationBridge`, inside `SQLiteProvider`)
- Modify: `src/state/app.ts`, `app/_layout.tsx`
- Test: `src/account/__tests__/autoBackup.test.ts`

**Interfaces:**
- Consumes:
  - `createAccountApi`, `loadSession`/`saveSession` (Task 6)
  - `exportData` (existing)
  - `useApp.dataVersion`
- Produces:
  - In `useApp`:
    - `account: null | { email: string; savedAt: number | null; state: 'ok' | 'elsewhere' | 'offline' }`
    - `setAccount(a)`
    - `backupNow: () => void`: set by the bridge; the default does nothing.
  - `backupDue({ dirty, lastSavedAt, now, reason }: { dirty: boolean; lastSavedAt: number | null; now: number; reason: 'change' | 'background' | 'start' }): boolean`
    - `change` → `dirty`
    - `background` → `dirty`
    - `start` → `dirty`, or `lastSavedAt` null or more than 24 hours old
  - `runBackup(deps: { db; api; session; now }): Promise<'saved' | 'elsewhere' | 'offline' | 'skipped'>`
    - `'skipped'` when there's no profile, so setup isn't done.
    - It saves `savedAt` into the session.
- Bridge behaviour:
  - It loads the session on start.
  - After a `dataVersion` change, it waits 30 s, then backs up.
  - It backs up when `AppState` goes to `background`, and once on start.
  - A 409 sets `state: 'elsewhere'` and stops further backups until claim.
  - A network error sets `'offline'` and retries on the next trigger.

- [ ] **Step 1: Write the failing tests:**
  - `backupDue` across the three reasons, including the 24-hour edge (exactly 24 h is false, 24 h + 1 ms is true).
  - `runBackup` with a fake api and `createTestDb`:
    - `'skipped'` without a profile, with no request made;
    - `'saved'` when the api answers 204, with `session.savedAt` set to `now`;
    - `'elsewhere'` on `AccountError` 409 `other-device`;
    - `'offline'` when fetch rejects.
- [ ] **Step 2:** `npx jest src/account/__tests__/autoBackup.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the logic, the bridge and the state.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit && npm run lint`. Expected: all pass, clean.
- [ ] **Step 5:** Commit: `Back up by itself after changes, on leaving the app, and daily`.

### Task 8: The sign-in screens

**Files:**
- Create: `app/account/_layout.tsx` (Stack, no header), `app/account/email.tsx`, `app/account/code.tsx`, `app/account/restore.tsx`, `app/account/choose.tsx`
- Modify: `app/onboarding/index.tsx` (welcome)
- Create: `public/privacy.html`

**Interfaces:**
- Consumes: Tasks 5 to 7.
- Routes and params:
  - `/account/email?from=welcome|settings` → `/account/code?email=…&from=…`
  - Then `afterSignIn` decides:
    - `setup` → `/onboarding/name`
    - `restore` → `/account/restore`
    - `choose` → `/account/choose`
    - `claim` → claim, back up now, then `router.back()` to Settings
- Behaviour:
  - **email.tsx:** the consent checkbox must be on before "Send my code" works. The line reads: "Back up my pills, marks, moods, answers and the people I add to Steady's server." "Privacy" opens `/privacy.html` (web) or the web app's `/privacy.html` (Android, via `openUrl`).
  - **code.tsx:** six boxes backed by one hidden `TextInput` (`keyboardType="number-pad"`, `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`). `digitsFromPaste` runs on every change, and it submits at 6 digits. "Send a new code" is disabled for 30 s. Errors use calm words: "That code didn't work. Try again, or send a new one."
  - **restore.tsx:**
    - Shows "Welcome back, {name}." and "Getting your pills, marks and settings…".
    - Runs `getBackup`, then `importData`, then `claim`. Then it reconciles doses, runs `syncSoon` and `bumpData`, and goes `router.replace('/home')`.
    - `NewerBackupError` shows "This backup is from a newer Steady. Update Steady, then sign in again." Other failures show the `LoadProblem` pattern with Try again, and the device data stays untouched.
  - **choose.tsx:** "Use your backup" goes to restore. "Keep this phone's data" claims, backs up now, then goes back.
  - **Welcome:**
    - "Continue with email" is the primary button; "Start without an account" is a link to `/onboarding/name`.
    - The note under them is the account sentence. Today's notes move to under "Start without an account".
  - **Setup after a new account** runs exactly as today. `completeOnboarding` then calls `useApp.getState().backupNow()`.

- [ ] **Step 1:** Write the screens using the existing `StepLayout`, `TextField`, `Button` and `Glass`, and `useReducedMotion` for the box focus.
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npx jest src/theme/a11y.test.ts`. Expected: clean; every Pressable has a label.
- [ ] **Step 3: Web check** (`npm run build:web`, local server, built-in browser at 375×812):
  - The welcome shows both choices.
  - "Start without an account" leads to name, as before.
  - Email → code against a local server:
    - Start it from `server/` with `npx wrangler dev --local --port 8787 --var MAIL_MODE:log --var ALLOWED_ORIGIN:http://localhost:8080`.
    - Build the web app with `EXPO_PUBLIC_ACCOUNT_URL=http://localhost:8787`.
    - The code shows up in the wrangler log.
  - Run a new account, setup, and then restore after clearing site data.
- [ ] **Step 4:** Commit: `Sign-in screens: welcome, email, code, restore, choose; privacy page`.

### Task 9: Settings → Account and honest wording

**Files:**
- Modify: `app/(tabs)/settings.tsx`, `app/onboarding/notifications.tsx`
- Create: `src/account/savedAgo.ts` and its test

**Interfaces:**
- Produces: `savedAgo(savedAt: number | null, now: number): string`
  - "not yet"; "just now" under 1 minute; "2 min ago"; "3 h ago"; "yesterday"; "4 days ago"
- Behaviour, when signed in, the "Account" section has:
  - email;
  - "Backup · saved {savedAgo}" (tap to back up now);
  - "Sign out", which asks first, clears the session, and keeps the data;
  - "Sign out everywhere";
  - "Delete my account", a sheet with typed `delete` like Delete everything. It calls `deleteAccount` and clears the session.
- In state `elsewhere`, the Backup row reads "Your backup is now on another device", with "Use this phone": claim, then back up now.
- Not signed in: one row, "Back up with email" → `/account/email?from=settings`.
- The Reminders privacy line and the notifications step's line follow the honest-wording rule in Global Constraints.

- [ ] **Step 1: Write the failing test:** `savedAgo` for null, 30 s, 2 min, 3 h, 26 h and 4 days.
- [ ] **Step 2:** `npx jest src/account/__tests__/savedAgo.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `savedAgo` and the Settings section.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit && npm run lint`. Expected: all pass, clean.
- [ ] **Step 5:** Commit: `Settings: Account section, backup status, sign out, delete; honest privacy lines`.

### Task 10: End to end, then release (needs the owner)

- [ ] **Step 1: Web, against the live server,** with the owner's own email. The owner types the code; never type it for them.
  1. New account, then setup; Settings shows "saved just now".
  2. Add a pill; the backup updates.
  3. Clear site data, sign in again, and "Welcome back" restores everything.
  4. "Keep this phone's data".
  5. Sign out.
  6. Delete my account; the old token then gets 401.
  7. "Start without an account" is unchanged.
- [ ] **Step 2: Android.** Ask the owner, then build a preview APK (`npx eas-cli@latest build --platform android --profile preview --non-interactive`). Install it on the emulator over preview 5. Then:
  1. Sign in from Settings → choose.
  2. A fresh install restores.
  3. With the web signed in to the same account, the phone shows "Your backup is now on another device".
- [ ] **Step 3:** README: the bullet "Everything stays on your phone: no account, no tracking" becomes "Optional sign-in with email, so a new phone gets everything back. No tracking." Release notes for the preview. Update the vault's Steady notes (Hub, Product, Tech, Status and Next) and the decision log, following the vault rules.
- [ ] **Step 4:** Ask the owner before pushing to main and publishing the release.
