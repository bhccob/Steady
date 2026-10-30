import type { Med } from '../db/dao/meds';

/** Whether any pill is still being taken. Stopped pills stay in the map only for their names in history. */
export function hasPills(meds: ReadonlyMap<string, Med>): boolean {
  for (const m of meds.values()) if (m.active) return true;
  return false;
}
