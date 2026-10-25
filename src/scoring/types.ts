import type { DoseStatus } from '../db/schema';
import type { LocalDate } from '../lib/time';

/** What the scoring engine needs from a dose. A DAO `Dose` satisfies it. */
export interface ScoringDose {
  dueLocalDate: LocalDate;
  dueAtUtc: string;
  status: DoseStatus;
}
