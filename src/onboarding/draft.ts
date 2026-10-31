import type { GuardianChannel, MedForm, StillUp, SupportLevel } from '../db/schema';
import type { Condition } from '../support/level';

export interface DraftMed {
  /** Stable key for list rendering only; the database id is made on save. */
  key: string;
  /** Empty means "my pill". */
  label: string;
  amount: string;
  form: MedForm;
  color: string;
  /** Minutes after local midnight. */
  times: number[];
  /** 0 = Sunday. Empty means every day. */
  days: number[];
}

export interface DraftSleep {
  bedtimeMin: number;
  wakeMin: number;
  windDown: boolean;
  /** Null follows the support level. */
  stillUp: StillUp | null;
}

export interface DraftGuardian {
  name: string;
  relationship: string;
  channel: GuardianChannel;
  /** Phone, WeChat ID, Instagram handle, or their Steady code for in-app. */
  contact: string;
}

/** Everything onboarding collects before it is saved in one go on the last step. */
export interface OnboardingDraft {
  name: string;
  ageConfirmed: boolean;
  meds: DraftMed[];
  conditions: Condition[];
  /** Null keeps the suggested level. */
  chosenLevel: SupportLevel | null;
  /** Null means bedtime reminders are off. */
  sleep: DraftSleep | null;
  guardian: DraftGuardian | null;
}

let seq = 0;

export function newDraftMed(): DraftMed {
  seq += 1;
  return { key: `med-${seq}`, label: '', amount: '', form: 'pill', color: '#F5DA6B', times: [480], days: [] };
}

export const DEFAULT_SLEEP: DraftSleep = { bedtimeMin: 23 * 60, wakeMin: 7 * 60, windDown: true, stillUp: null };

/**
 * What the sleep editor starts with: the saved times, or with none saved, bedtime reminders off
 * from Settings and 23:00 to 07:00 suggested (on) from Home's setup list.
 */
export function sleepToEdit(
  saved: { bedtimeMin: number | null; wakeMin: number | null; windDown: boolean; stillUp: StillUp | null },
  suggest: boolean,
): DraftSleep | null {
  if (saved.bedtimeMin !== null && saved.wakeMin !== null) {
    return { bedtimeMin: saved.bedtimeMin, wakeMin: saved.wakeMin, windDown: saved.windDown, stillUp: saved.stillUp };
  }
  return suggest ? { ...DEFAULT_SLEEP } : null;
}

/** Setup asks only 18+ and the safety note; pills, sleep and the rest come from Home's Get set up list. */
export function emptyDraft(): OnboardingDraft {
  return { name: '', ageConfirmed: false, meds: [], conditions: [], chosenLevel: null, sleep: null, guardian: null };
}
