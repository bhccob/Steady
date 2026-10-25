// Every word a notification can show (spec §5.5). Lowercase, no emoji, no exclamation
// marks, never the med's name or amount, never "missed", "late" or "forgot".
// __tests__/copy.test.ts checks all of it.

const named = (name: string, line: string) => (name.trim() ? `${name.trim()}, ${line}` : line);

export const COPY = {
  first: (name: string) => named(name, "a small mark when you're ready."),
  repeat: 'still here.',
  /** The extra reminders Steady and Close add between the second and the last. */
  middle: "whenever you're ready.",
  final: "no rush. it's here when you are.",
  /** Several reminders right after quiet hours, folded into one. */
  collapsed: 'a few things are waiting.',
  windDown: (name: string) => named(name, 'time to start winding down.'),
  stillUp: "it's past your bedtime. rest helps tomorrow feel steadier.",
};

export const ACTION_LABELS = {
  taken: 'Taken',
  snooze: 'Snooze 30',
  goodnight: 'Goodnight',
  later: '15 more min',
};

/** The body of reminder `k` (0-based) out of `n` for one dose. */
export function doseBody(name: string, k: number, n: number): string {
  if (k === 0) return COPY.first(name);
  if (k === n - 1) return COPY.final;
  return k === 1 ? COPY.repeat : COPY.middle;
}
