// Support level: how closely Steady looks out for someone, from what they say they
// are working through. A simple, visible rule the user can always override. It is
// not a clinical assessment and should be reviewed by a clinician before release.
import type { Severity, StillUp, SupportLevel } from '../db/schema';
import { CONDITIONS } from './conditions';

export interface Condition {
  name: string;
  severity: Severity;
}

export const SEVERITY_LABELS: Record<Severity, string> = { 0: 'Mild', 1: 'Moderate', 2: 'Severe' };

const WEIGHT = new Map(CONDITIONS.map((c) => [c.name, c.weight]));

/** Weight plus severity for the condition that needs the most care: 4+ close, 2-3 steady. */
export function suggestedLevel(conditions: readonly Condition[]): SupportLevel {
  const score = Math.max(0, ...conditions.map((c) => (WEIGHT.get(c.name) ?? 1) + c.severity));
  if (score >= 4) return 'close';
  if (score >= 2) return 'steady';
  return 'light';
}

export interface LevelRule {
  /** Notifications for one dose, the first included. */
  remindersPerDose: number;
  /** Minutes overdue before the help sheet is offered; null means only when opened. */
  helpAfterMin: number | null;
  /** When a "rough" mood offers the help sheet. */
  helpOnRough: 'never' | 'after_two_days' | 'right_away';
  checkIns: readonly ('morning' | 'evening')[];
  stillUp: StillUp;
}

export const LEVEL_RULES: Record<SupportLevel, LevelRule> = {
  light: { remindersPerDose: 3, helpAfterMin: null, helpOnRough: 'after_two_days', checkIns: ['morning'], stillUp: 'once' },
  steady: { remindersPerDose: 4, helpAfterMin: 60, helpOnRough: 'after_two_days', checkIns: ['morning'], stillUp: 'every30' },
  close: { remindersPerDose: 5, helpAfterMin: 30, helpOnRough: 'right_away', checkIns: ['morning', 'evening'], stillUp: 'every15' },
};

/** The user's own still-up choice wins; otherwise the level decides. */
export function stillUpFor(level: SupportLevel, chosen: StillUp | null): StillUp {
  return chosen ?? LEVEL_RULES[level].stillUp;
}
