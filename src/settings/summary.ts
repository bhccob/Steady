const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday first, as on screen. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "08:00, 20:00 daily", "08:00 weekdays", or "08:00 · Mon, Wed, Fri". */
export function scheduleSummary(times: readonly string[], days: readonly number[]): string {
  if (!times.length) return 'no times set';
  const t = times.join(', ');
  const set = new Set(days);
  if (set.size === 0 || set.size === 7) return `${t} daily`;
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return `${t} weekdays`;
  if (set.size === 2 && set.has(0) && set.has(6)) return `${t} weekends`;
  return `${t} · ${WEEK_ORDER.filter((d) => set.has(d))
    .map((d) => DAY_NAMES[d])
    .join(', ')}`;
}
