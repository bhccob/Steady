import type { DoseStatus } from '../db/schema';
import { addDays, type LocalDate } from '../lib/time';
import type { ScoringDose } from '../scoring/types';

/** Doses on one local date, one per status, due 08:00, 09:00, ... UTC. */
export function day(date: LocalDate, ...statuses: DoseStatus[]): ScoringDose[] {
  return statuses.map((status, i) => ({
    dueLocalDate: date,
    dueAtUtc: `${date}T${String(8 + i).padStart(2, '0')}:00:00.000Z`,
    status,
  }));
}

/** `n` consecutive days from `start`, each with `perDay` doses of `status`. */
export function days(start: LocalDate, n: number, status: DoseStatus, perDay = 1): ScoringDose[] {
  return Array.from({ length: n }, (_, i) =>
    day(addDays(start, i), ...Array.from({ length: perDay }, () => status)),
  ).flat();
}

export function dose(dueAtUtc: string, status: DoseStatus): ScoringDose {
  return { dueAtUtc, dueLocalDate: dueAtUtc.slice(0, 10), status };
}
