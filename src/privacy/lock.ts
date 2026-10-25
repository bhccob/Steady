/** A quick trip to another app comes back in without asking again. */
export const LOCK_GRACE_MS = 30_000;

/** Whether the face or fingerprint lock should cover the app now. */
export function shouldLock(input: { enabled: boolean; launching: boolean; backgroundedAt: number | null; now: number }): boolean {
  if (!input.enabled) return false;
  if (input.launching) return true;
  return input.backgroundedAt !== null && input.now - input.backgroundedAt >= LOCK_GRACE_MS;
}
