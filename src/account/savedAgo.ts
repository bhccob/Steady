const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** When the backup last saved, as Settings says it: "just now", "2 min ago", "yesterday". */
export function savedAgo(savedAt: number | null, now: number): string {
  if (savedAt === null) return 'not yet';
  const ago = Math.max(0, now - savedAt);
  if (ago < MIN) return 'just now';
  if (ago < HOUR) return `${Math.floor(ago / MIN)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  if (ago < 2 * DAY) return 'yesterday';
  return `${Math.floor(ago / DAY)} days ago`;
}
