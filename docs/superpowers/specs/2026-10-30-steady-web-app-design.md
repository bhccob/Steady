# Steady on the web, and a livelier glow

Status: draft for approval · 30 October 2026

## Why

Steady only reaches Android today: friends install an APK from GitHub. iPhone friends can't install it at all, and an App Store release is a long way off. The owner's other project, Portle, shows the way they want: a web app you open in Safari, add to the Home Screen, and then use like an app (full screen, its own icon, no browser bars).

Separately, the owner finds Steady's glow flat. The four background glows are painted once and never move, and nothing lights up when you point at it or touch it.

## What success looks like

- An iPhone friend opens one link, adds Steady to the Home Screen, sets it up, and gets their reminders at the times they chose, with the same gentle words as on Android. They mark doses in the app, and their history is still there weeks later.
- Android friends can keep using the APK. It loses nothing and gains the new glow.
- The background glow feels alive but calm. Buttons, cards and streak blocks glow softly under the mouse on the web and under a finger on a phone.

## Goals

1. A web build of Steady from the same codebase, installable from the browser, aimed at iPhone first (Safari, iOS 16.4 or later) and also working in Chrome on Android and desktop.
2. Reminders for the installed web app, sent by a small server, with a strict privacy contract (below).
3. The living background glow and the hover and press glow, in both the phone app and the web app.

## Non-goals

- An App Store app, or any native iOS build.
- Accounts, sign-in, or syncing data between a phone's APK and the web app. They are separate, independent copies.
- Keeping health data on a server, or backing it up there.
- The phone-only extras on the web: home-screen widget, buttons on notifications, picking from contacts, vibration, fingerprint lock, hiding from the app switcher.
- A desktop layout. On a wide screen the web app shows the phone layout, centred (the existing 560 px content width).

## Anti-goals (failures even if it "works")

- The server learning a name, med, mood, condition, support level or guardian, or anything readable in a notification.
- Reminder wording that differs from the app's rules: never naming the med, never saying "missed".
- Any change that makes the Android app slower, less reliable, or different in behaviour, apart from the glow.
- A glow that flashes, distracts, draws attention to the app on a lock screen, or noticeably drains a battery.

## Decided by the owner

- Build the web version, installable from the browser, like Portle.
- iPhone reminders come from a **small server**. It knows only an anonymous address for the phone, the reminder times, and which reminders to drop when a dose is marked.
- The per-minute reminder check runs on a **free Cloudflare account**, which the owner creates. The website is hosted on the owner's **Vercel** account (team "bhccob", free plan), next to Portle.
- The glow work covers **both**: the background glow moves, and things glow on hover (web) and touch (phone).

## How it fits together

```
iPhone (installed web app)                       Cloudflare (free)                Apple / Google push service
 Steady web app ── sync reminder times ───────►  Worker + D1 database
   │   (ids + times only, no text)                 cron every minute ──────────► sends "reminder <id> is due"
   │                                                                              (encrypted, no text)
 service worker ◄────────────────────────────────────────────────────────────────┘
   └─ looks up that reminder's words, stored on the phone, and shows the notification
Vercel (free): serves the web app's files, with the headers below
```

### 1. The web app (same code, built for the browser)

- Built with Expo's web support from this repo: add `react-native-web` and Expo's web runtime with `npx expo install`, and export with `npx expo export --platform web`. Keep one codebase; where a phone-only module is used, add a small web version of that one file (`*.web.ts`) or a `Platform.OS` check. Don't fork screens.
- Installable: a web manifest plus Home Screen meta tags in `app/+html.tsx`. The icons, manifest and head tags are already made in `brand/icons/web/` (favicon, `apple-touch-icon.png`, 192, 512 and maskable icons, `site.webmanifest`, `head-snippet.html`). `display: standalone`, portrait, start at `/`, theme colour Paper `#F5F3EF`.
- A service worker (`public/sw.js`, registered only on the web). It shows reminders (section 3) and caches the app's files so Steady opens with no signal. Reminders still need a signal to arrive.
- **Install first** (my call): opened in a plain browser tab, Steady shows one calm screen before setup. It explains how to add it to the Home Screen (iPhone: Share, then Add to Home Screen; Chrome: the install button). It says why: reminders and keeping your data only work once installed. A small "Continue in the browser anyway" link stays available; reminders are then explained as off.
- Hosting: a new Vercel project for the repo's web build, at the free `*.vercel.app` address (my call; a custom domain can come later). Static files with a fall-back to `index.html` for app routes. Headers: see Constraints.
- The README's download section gets an iPhone line ("Open steady… in Safari, then Share → Add to Home Screen"); Android keeps the APK link. **Not before the owner has confirmed on a real iPhone** (my call): install, a reminder arriving, and data surviving a few days. Until then the web address isn't advertised anywhere.

### 2. Data on the web

- The existing SQLite database code runs unchanged: `expo-sqlite` has a web mode (SQLite compiled to WebAssembly, stored in the browser's private file storage). Metro must bundle `.wasm`, and the page must be "cross-origin isolated" (headers below).
- Data lives only on that phone, inside the installed web app. Safari erases website data after 7 days without a visit, but apps added to the Home Screen are exempt. Also ask the browser for persistent storage (`navigator.storage.persist()`).
- On iPhone, the Home Screen app does not share storage with Safari tabs. Anything set up in a tab is left behind when you install, which is the main reason setup comes after Install first.
- Export works on the web as a file download (`exportFile.ts` gets a web version). **Delete everything** also deletes this phone's record on the reminder server.

### 3. Reminders on the web

**What the server may know (the privacy contract):**
- A random install id and secret, created on the phone.
- The browser's push address and its encryption keys, which the push standard requires.
- For each upcoming reminder: its id, the time it's due, and its kind (dose, last dose reminder, bedtime).
- Nothing else. No text, name, med, mood, condition, support level, guardian or dose details. Reminder ids must not encode any of those: hash or randomise the ids sent to the server, and keep the mapping on the phone.

**On the phone:**
- A new `NotificationPort` for the web (`webPushPort`), beside the Android `expoPort`. The planner (`plan.ts`) and the diff-sync (`scheduler.ts`) stay exactly as they are, so the reminder rules are identical on both. The port:
  - asks for permission and subscribes to push, only from a tap in the installed app (iOS insists);
  - keeps a local copy of each scheduled reminder (id → words, time, kind) in IndexedDB, which the service worker can read;
  - sends the server only id, time and kind for `schedule` and `cancel`;
  - answers `scheduled()` from the local copy.
- Marking a dose already cancels its follow-ups through the port. That cancel reaching the server is what stops further reminders.
- When a push arrives, the service worker looks up the id in the local copy and shows that reminder's words. Tapping the notification opens Steady on Home. iOS requires every push to show a notification, or it eventually revokes push.
- **Marked while offline** (my call): cancels that fail are queued on the phone and retried when the connection returns. If a reminder still arrives for a dose the phone knows is marked, the service worker shows a quiet line that doesn't nag ("you're all marked.") instead of the reminder. If the id is unknown, it shows the neutral "a small mark when you're ready." (Lowercase, per the notification copy rules in `src/notify/copy.ts`.)
- **Keeping reminders coming** (my call): the planner only looks a few days ahead (60 reminders at most), and the web app can only re-plan when it's opened. If Steady isn't opened for about five days, reminders would quietly run out. Same as Android today, but on iPhone every mark needs an open, so it matters more. On the web only, an hour after the last planned reminder the port adds one last notice in the app's voice: "open steady when you can, so your reminders keep coming." Never more than one.
- Onboarding's notification step and Settings say plainly what the server holds, in one short sentence in the app's voice, on the web only. The "nothing leaves this phone" lines elsewhere get a web-only exception that names the reminder times.

**On the server (Cloudflare Worker + D1):**
- Endpoints, authorised by the install's secret:
  - register or replace the push address;
  - replace this install's full list of upcoming reminders (simplest to keep in step with the diff-sync);
  - delete the install.
- Requests are accepted only from the Steady web app's address (CORS). Each install is capped at 60 reminders, the planner's own limit. Requests are rate-limited per install and per IP.
- A cron trigger every minute sends a push for each reminder due at or before now, then deletes it. Pushes use VAPID and Web Push encryption, with a payload of the id only. Reminders arrive within about a minute of their time.
- Clean-up: delete a push address the push service reports gone (404/410). Delete installs with no reminders and no contact for 30 days. The server keeps no logs of reminder times beyond what's needed to send them.
- Keys: the VAPID private key is stored as a Cloudflare secret, and the public key goes in the web app's config. Neither is committed.

### 4. Phone-only features on the web

| Feature (where) | On the web |
|---|---|
| Notification buttons and background task (`backgroundTask.ts`, `index.ts`) | Not loaded. Tapping a reminder opens Steady instead. |
| Widget (`src/widget/*`, `index.ts`) | Not loaded. |
| Fingerprint/face lock (`PrivacyGate.tsx`, Settings) | Option hidden on the web. |
| Hide in app switcher (`settings.tsx`) | Option hidden on the web. |
| Pick a guardian from contacts (`guardians.tsx`) | Hidden. Typing a name and number still works. |
| Vibration (`haptics.ts`, `MoodPrompt.tsx`) | Does nothing on the web. |
| Export file (`exportFile.ts`) | Downloads the JSON file. |
| Frosted glass (`Glass.tsx`, expo-blur) | CSS backdrop blur, or the existing solid fallback if it misbehaves in Safari. |
| Calling or messaging a crisis line or guardian (links) | Works as links (`tel:`, `sms:`, WhatsApp). |

### 5. The glow (phone app and web app)

- **Background:** the four glows in `Background.tsx` become four separate soft layers. Each drifts a little and breathes slowly: a few percent of the screen, opacity about ±15%, scale 1 to 1.08. Each layer has its own long cycle (about 23, 29, 31 and 37 seconds), so the movement never visibly repeats. Smooth ease-in-out, nothing faster than that. Only `transform` and `opacity` animate. On phones the existing `Animated` runs with the native driver, so no new library is needed (my call, as this is a timed loop, not a finger-driven gesture). On the web it's a CSS keyframe animation. It stays still under Reduce Motion, and on devices where the startup speed check already picks solid glass.
- **Hover and press:** tappable surfaces get a warm halo in the theme's accent, with a hint of lift. That covers primary buttons, tappable glass cards, list rows, streak path blocks, mood faces, tab bar items and the check button. On the web it appears on mouse hover, fading in over 150 ms with ease-out, with a pointer cursor. On a phone it appears on press-in in about 100 ms and fades over about 200 ms on release. Keyboard focus on the web shows the same halo. Draw the halo once as its own layer and animate only its opacity (and the lift as a transform). Never animate a shadow or elevation, which repaints every frame on Android. Build it once, as a shared wrapper or style used by those components, not per screen. Under Reduce Motion the halo still appears but nothing moves or scales.
- The comeback glow is unchanged.

## Constraints

- **iPhone:** push only works for web apps added to the Home Screen, on iOS 16.4 or later, after the person allows it from a tap inside the app. iPhone web notifications show no buttons.
- **Cross-origin isolation:** the database needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy`. Expo's docs suggest `credentialless`, but Safari may need `require-corp`. Pick the value that makes `crossOriginIsolated` true in Safari on iOS. Everything the app loads must come from its own address. Serve the headers from Vercel (`vercel.json`) and from the dev server (Metro middleware).
- **Free tiers:** Vercel Hobby can't run per-minute jobs, which is why the reminder check is on Cloudflare. Workers Free has a small CPU allowance per run. If one minute has more due reminders than fit in a run, send them in batches.
- **No new tracking:** no analytics, no third-party scripts, no fonts or assets from other addresses. That keeps the privacy promise and the isolation headers.
- **The Android app must keep passing** its 564 tests, lint and typecheck, and still build on EAS.

## Who does what

- **The owner:** creates the free Cloudflare account and signs in once from this PC (`npx wrangler login` opens a browser). Approves creating the Vercel project. Tests on a real iPhone.
- **The builder:** everything else. That includes creating the VAPID keys and storing the private key as a Cloudflare secret through wrangler, without printing it.

## Risks, riskiest first

1. **The database in an installed iPhone web app.** Cross-origin isolation, WebAssembly and private file storage in Safari's Home Screen mode. Prove this first with a throwaway page on a real iPhone, before anything else. If it fails, the fallback is a web-only storage layer behind the same `Db` interface.
2. **iPhone push end to end:** permission, subscription, the cron-to-push path and the service worker's notification. Only a real iPhone can confirm it, so the owner will need to test it.
3. **Expo web build quirks** in screens that assume native: gestures in the streak path, `boxShadow` and `backgroundImage` support, the blur.

## Testing

- **Jest:**
  - the web port against a fake server: schedule, cancel, sync and delete-everything;
  - the Worker's routes and cron logic with a fake push sender, including the 60 cap, auth, the 404/410 clean-up and batching;
  - a guard test that nothing sent to the server contains reminder text or ids carrying meaning;
  - the glow layer config, so Reduce Motion means no animation.
- **In this PC's browser:** the exported web build installs (Chrome), sets up, persists across reloads, and receives a push from the deployed Worker. Hover glow and the background motion are checked by eye.
- **Android emulator:** the APK still behaves the same, apart from the glow (press halo, background motion).
- **Real iPhone (the owner):** install, setup, a reminder at a set time, tapping it, marking, and data still there after a few days.

## Left to the builder

File layout, library choices for the Worker (Web Push encryption on Workers), D1 schema, exact animation values within the ranges above, the install-first screen's wording (in the app's voice), the order of work after the risk-1 spike, and how the dev server serves the headers.
