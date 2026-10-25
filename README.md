# Steady

A calm, private medication reminder for people working through hard things.

Steady helps you keep track of your meds without shame or pressure: small marks, gentle reminders, and a streak that grows one block per marked day. Everything stays on your phone. There's no account, no email and no tracking.

## What it does

- **Gentle reminders** that never name your medication, never say "missed", and go quiet after a few tries. Mark a dose straight from the notification.
- **A streak path** of blocks that recede into the distance, with a trophy at the end of every week.
- **Calendar and Insights**: your own patterns, shown only to you.
- **Support levels**: tell Steady what you're working through (optional, private), and it adjusts how often it reminds you and how soon it offers help.
- **Sleep**: bedtime nudges, and Goodnight to quiet everything until morning.
- **Reach out**: one tap to people you trust or a free 24/7 crisis line. Steady never contacts anyone for you.
- **Harder times** (opt-in): during times you find hard, a gentle card with a 60-second breathing exercise.
- **Privacy**: face or fingerprint lock, hide in the app switcher, export or delete everything.
- **Android widget**: next dose, a Taken button and today's marks on your home screen.

## Not medical advice

Steady helps you keep track. It isn't medical advice and doesn't replace care from your doctor or pharmacist. The support-level rule is a simple, visible heuristic, not a clinical assessment.

## Running it

Built with Expo (SDK 58), React Native and TypeScript. Data lives in SQLite on the device.

```sh
npm install
npx expo start
```

Most of the app runs in Expo Go. Background marking from notifications and the Android widget need a development build:

```sh
npx eas-cli build --profile development --platform android
```

Checks:

```sh
npm test
npm run typecheck
npm run lint
```
