// Where people's answers live, said honestly. Without an account the old promise stays word for
// word; signed in, Steady's server keeps a backup of everything, so no line may say otherwise.

/** Under "What are you working through?" in setup. */
export function supportStepNote(signedIn: boolean): string {
  return signedIn
    ? "Optional and private. Pick any that fit, or none. It's kept in your backup on Steady's server and helps Steady know how closely to look out for you."
    : 'Optional and private. Pick any that fit, or none. It stays on this phone and helps Steady know how closely to look out for you.';
}

/** Under "What I'm working through" in Settings. */
export function supportEditNote(signedIn: boolean): string {
  return signedIn
    ? "Private, and kept in your backup on Steady's server. It helps Steady know how closely to look out for you."
    : 'Private, on this phone only. It helps Steady know how closely to look out for you.';
}

/** On the last setup step, "Before we start". */
export function legalDataNote(signedIn: boolean, web: boolean): string {
  if (signedIn) return "You're signed in, so Steady's server keeps a backup of everything. You can export it or delete it any time in Settings.";
  return web
    ? 'Everything else stays on this phone. You can export it or delete it any time in Settings.'
    : 'Everything stays on this phone. You can export it or delete it any time in Settings.';
}
