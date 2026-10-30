import type { Db } from '../db/types';
import type { NotificationPort } from './scheduler';

// The web has no reminders yet (they come with the reminder server): a port that accepts every
// call and schedules nothing, so the rest of the app runs unchanged.
export const activePort: NotificationPort = {
  permitted: async () => false,
  scheduled: async () => [],
  schedule: async () => {},
  cancel: async () => {},
  dismiss: async () => {},
};

export function syncSoon(db: Db): void {
  void db;
}

export async function setupNotifications(): Promise<void> {}
