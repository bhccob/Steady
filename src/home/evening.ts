import type { SupportLevel } from '../db/schema';
import { LEVEL_RULES } from '../support/level';

/** Evening starts here, in minutes after local midnight. */
const EVENING_MIN = 18 * 60;

/** Close checks in morning and evening. The evening one asks once, after 18:00, never on top of the morning one. */
export function eveningCheckinDue(input: {
  level: SupportLevel;
  nowMinutes: number;
  morningShowing: boolean;
  eveningDone: boolean;
  dismissed: boolean;
}): boolean {
  return (
    LEVEL_RULES[input.level].checkIns.includes('evening') &&
    input.nowMinutes >= EVENING_MIN &&
    !input.morningShowing &&
    !input.eveningDone &&
    !input.dismissed
  );
}
