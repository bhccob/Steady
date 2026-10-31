// Home's Get set up list. Setup before Home asks only what Steady can't run without (18+ and the
// safety note); everything else waits here, ticked off from what is saved, until it's done or hidden.

export type SetupStep = 'pill' | 'reminders' | 'support' | 'sleep' | 'someone';

const ORDER: readonly SetupStep[] = ['pill', 'reminders', 'support', 'sleep', 'someone'];

export interface SetupFacts {
  hasPills: boolean;
  remindersOn: boolean;
  conditionCount: number;
  levelChosen: boolean;
  bedtimeSet: boolean;
  guardianCount: number;
  /** Steps saved even with nothing picked: no conditions, or bedtime reminders off. */
  answered: readonly string[];
  hidden: boolean;
}

export interface SetupRow {
  step: SetupStep;
  done: boolean;
}

/** The list in order, or null once it's hidden or every step is done. */
export function setupList(f: SetupFacts): SetupRow[] | null {
  if (f.hidden) return null;
  const done: Record<SetupStep, boolean> = {
    pill: f.hasPills,
    reminders: f.remindersOn,
    support: f.conditionCount > 0 || f.levelChosen || f.answered.includes('support'),
    sleep: f.bedtimeSet || f.answered.includes('sleep'),
    someone: f.guardianCount > 0,
  };
  const rows = ORDER.map((step) => ({ step, done: done[step] }));
  return rows.every((r) => r.done) ? null : rows;
}
