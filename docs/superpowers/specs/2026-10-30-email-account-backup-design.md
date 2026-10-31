# Steady: sign in with email, and a backup

Status: draft for approval · 30 October 2026

## Why

The owner wants a more professional sign-up where people add their email, and an account so that someone who loses or replaces their phone gets everything back: pills, marks, streak, moods, settings. Today Steady has no account at all. Everything lives on the phone, and a lost phone means starting again from zero.

## What success looks like

- Sam replaces their phone. They install Steady, tap "Continue with email", type the 6-digit code from their inbox, and land on Home with their streak, pills, marks and settings exactly as they were.
- Someone who doesn't want an account still taps "Start without an account" and uses Steady exactly as today, with nothing leaving their phone except web reminder times (as now).
- The sign-up feels calm and professional: one question per screen, no password, no clutter.

## Decided by the owner

- **Email is the only way to sign in:** email address, then a 6-digit code sent to it. No passwords, no Google or Apple buttons.
- **Optional, but first:** the welcome screen leads with "Continue with email". "Start without an account" stays, one tap away.
- **Restore with only the email.** No recovery code. This means the server can read people's backups (see Privacy).
- **Everything is backed up,** including "What I'm working through" (conditions such as psychosis or thoughts of suicide).
- The sign-up screens follow the mockup `.superpowers/brainstorm/59055-1793374256/content/account-signup-v3.html` (welcome, email, code, Settings → Account).

## Goals

1. Sign in with email and a code on Android and the web, from the welcome screen or later from Settings.
2. A backup of all of a signed-in person's data on Steady's server, kept up to date by itself.
3. Restore on a new phone or browser: sign in, and everything comes back.
4. People who already use Steady can add an account from Settings ("Back up with email") without losing anything.
5. "Delete my account" removes everything from the server.

## Non-goals

- Live sync between two devices used at the same time. It is backup and restore: the latest backup wins.
- Passwords, social sign-in, recovery codes, end-to-end encryption.
- In-app guardian connections, Steady codes or a leaderboard, even though accounts make them possible later.
- An iPhone app.
- Any change to reminders: they work exactly as now, signed in or not.

## Anti-goals (failures even if it works)

- Pressure to sign up: nagging, features locked behind an account, a sign-up wall.
- Saying something untrue. "Nobody else can see your pills or moods" must not be shown to signed-in people.
- Emails that mention pills, moods or health. Sign-in emails hold only the code and a plain sentence.
- Marketing email, analytics or tracking built on the backup.
- Losing data: a failed restore or a half-written backup must never wipe what is on the phone.

## The flow

1. **Welcome:** "Continue with email" (primary button), "Start without an account" (link under it). Small note: "With an account, Steady keeps a private backup so you can pick up on a new phone." The no-account path keeps today's note.
2. **Email:** one field, "Send my code". Under it, a clear consent line that must be accepted before sending: back up my pills, marks, moods and answers to Steady's server (wording left to the builder, but it must name what is stored, including the names and contact details of guardians the person adds), with a link to a short privacy page.
3. **Code:** six boxes, pasting fills them, moves on when complete. "Send a new code" (after 30 s) and "Use a different email". A code works for 10 minutes and for a limited number of tries.
4. **Then:**
   - New account: setup carries on as today (name, 18+, pills…). Backups start only after setup is complete, so nothing is stored before the 18+ step.
   - Account with a backup, on an empty device: "Welcome back, {name}", restore, then Home.
   - Account with a backup, on a device that already has data (signing in from Settings): ask "Use your backup" or "Keep this phone's data" (the second replaces the backup).
5. **Settings → Account** (signed in): email; "Backup · saved 2 min ago" (tap to back up now); "Sign out" (stops backing up; data stays on this phone); "Delete my account" (typed confirmation; removes the account and backup from the server; data stays on this phone). Not signed in: a "Back up with email" row that starts at step 2.
6. **New device alert:** signing in on a new device sends a plain email: "You signed in to Steady on a new device. If this wasn't you, open Steady and choose Sign out everywhere." Settings gets "Sign out everywhere".
7. **One device at a time** *(builder's-check call, not the owner's)*: when an account is signed in on a new device, the older device stops backing up and Settings there says "Your backup is now on another device", with a way to take it back. Without this, a phone and a browser signed in together would overwrite each other's backup in turn.

## Backup

- **Contents:** the full on-device data, the same tables the existing export covers (`src/settings/data.ts`), with its schema version.
- **When:** by itself, shortly after changes (debounced), when the app goes to the background, and on start if the last backup is over a day old. Failures retry quietly; Settings shows when it last saved.
- **Restore:** replaces the device's data with the backup, then rebuilds doses and reminders. It must be all or nothing: if anything fails, the device keeps what it had. A backup from a newer app version asks the person to update Steady first.
- **Kept on the server:** the latest backup, plus the one before it as a safety net.

## Server

- Extend the existing Cloudflare Worker `steady-reminders` (`server/`, D1) with account, code, session and backup storage. The builder chooses D1 or R2 for backup bodies, based on size.
- Backups are encrypted at rest with a server-held key (in Cloudflare's secret store), and always sent over HTTPS. This protects a copied database, not against the server itself.
- Sign-in codes are stored hashed; sessions are long-lived tokens kept in the device's secure storage where it exists. Rate limits on code requests and tries, per address and per email, keyed hashes as today.
- Sending email needs an email provider and a domain Steady owns (see Open questions).

## Privacy and honest wording

- This reverses the "No account. No email." promise and the web app design's anti-goal that the server never learns health data, **for people who sign in only**. People without an account keep the old promise word for word.
- Update every place that makes the old promise: the welcome note, the privacy lines in Settings and the notifications step, the README, release notes, and the vault's Steady notes.
- Health data has extra legal rules in places like the EU and UK. The consent line and privacy page are required. A check with someone who knows the law is recommended before inviting many people; it does not block a preview release.

## Open questions (the owner's)

1. ~~A domain and an email provider.~~ Settled 31 October: the owner bought **steadyapp.cc** (DNS on Cloudflare). Codes are sent through **Resend** (free plan: 3,000 emails a month, 100 a day), set up by the owner. The Worker reads its API key from Cloudflare's secret store as `RESEND_API_KEY`. Cloudflare's own email sending was ruled out because sending to anyone needs the $5-a-month Workers plan.
2. ~~Who the privacy page names.~~ Settled 31 October: it names **Steady**, with **privacy@steadyapp.cc** as the contact for questions and deletion requests (forwarded to the owner by Cloudflare Email Routing, which the owner sets up). Before inviting many people, the legal check above should confirm whether the page must also name the real person behind Steady.

Also not in this version *(builder's-check calls)*: changing the email on an account.

## Left to the builder

Screen details within the mockup's style, the consent wording, debounce timings, token format, storage choices, the code-entry component, retry behaviour, and how the privacy page is hosted.

## Testing

- Pure-logic tests first: backup export → import gives identical data; restore is all-or-nothing; code expiry and try limits; rate limits.
- Server tests for each new route, in the existing server test setup.
- By hand on the Android emulator and the web build: new account, restore on a fresh install, "Keep this phone's data", sign out, delete account, no-account path unchanged.
