import type { StillUp, SupportLevel } from '../db/schema';
import type { IconName } from '../ui/Icon';
import { LEVEL_RULES, SEVERITY_LABELS, type Condition } from './level';

export const LEVEL_NAMES: Record<SupportLevel, string> = { light: 'Light', steady: 'Steady', close: 'Close' };

export const STILL_UP_LABELS: Record<StillUp, string> = {
  off: 'Off',
  once: 'One reminder',
  every30: 'Every 30 min, up to 3',
  every15: 'Every 15 min, up to 4',
};

const STILL_UP_RULE: Record<StillUp, string> = {
  off: 'No nudges after bedtime',
  once: "One nudge if you're still up after bedtime",
  every30: "If you're still up after bedtime, a nudge every 30 minutes, up to 3",
  every15: "If you're still up after bedtime, a nudge every 15 minutes, up to 4",
};

/** What a level changes, in the user's words, for the level screen and Settings. */
export function describeLevel(level: SupportLevel): { icon: IconName; text: string }[] {
  const r = LEVEL_RULES[level];
  const rough = r.helpOnRough === 'right_away' ? ', or as soon as you pick rough' : ', or after two rough days';
  return [
    { icon: 'bell', text: `Up to ${r.remindersPerDose} reminders per dose${level === 'close' ? ', a little closer together' : ''}` },
    {
      icon: 'life-buoy',
      text: r.helpAfterMin === null ? 'The help sheet is there whenever you open it' : `The help sheet is offered after ${r.helpAfterMin} minutes overdue${rough}`,
    },
    { icon: 'sun', text: r.checkIns.length > 1 ? 'Morning and evening check-ins' : 'A morning check-in' },
    { icon: 'moon', text: STILL_UP_RULE[r.stillUp] },
    { icon: 'lock', text: 'Steady never contacts anyone for you.' },
  ];
}

/** Lowercases ordinary words for mid-sentence use; short forms like PTSD stay as they are. */
function inSentence(name: string): string {
  return name
    .split(' ')
    .map((w) => (/^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w))
    .join(' ');
}

/** "Based on psychosis (severe) and cocaine use (moderate)." */
export function levelReason(conditions: readonly Condition[]): string {
  if (!conditions.length) return 'Nothing selected, so Steady keeps a light touch.';
  const parts = conditions.map((c) => `${inSentence(c.name)} (${SEVERITY_LABELS[c.severity].toLowerCase()})`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Based on ${list}.`;
}
