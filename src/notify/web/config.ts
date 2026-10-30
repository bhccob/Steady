// Where the reminder server is, and its public VAPID key. Set at build time (Vercel env vars);
// empty means web reminders aren't available in this build.
export const PUSH_URL = process.env.EXPO_PUBLIC_PUSH_URL ?? '';
export const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
