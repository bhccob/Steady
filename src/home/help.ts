import type { DoseStatus, SupportLevel } from '../db/schema';
import { MINUTE_MS } from '../lib/time';
import { LEVEL_RULES } from '../support/level';

/** At Steady and Close, a dose left open this long gently offers the help sheet, once a day. */
export function shouldOfferHelp(input: {
  level: SupportLevel;
  doses: readonly { dueAtUtc: string; status: DoseStatus }[];
  now: string;
  offeredToday: boolean;
}): boolean {
  const after = LEVEL_RULES[input.level].helpAfterMin;
  if (after === null || input.offeredToday) return false;
  const now = Date.parse(input.now);
  return input.doses.some((d) => d.status === 'pending' && now - Date.parse(d.dueAtUtc) >= after * MINUTE_MS);
}
