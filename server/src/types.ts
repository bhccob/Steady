// Everything the reminder server may hold (spec: "What the server may know"). Nothing here can
// carry a name, med, mood or reminder text: ids are opaque, kinds are a fixed list.

export type Kind = 'dose' | 'dose_final' | 'bedtime' | 'other' | 'keep';
export const KINDS: readonly Kind[] = ['dose', 'dose_final', 'bedtime', 'other', 'keep'];

export interface Install {
  id: string;
  /** SHA-256 of the install's secret, hex. The secret itself is never stored. */
  secretHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Last time this install was registered or changed its reminders (ms). */
  touchedAt: number;
}

export interface Reminder {
  rid: string;
  dueAt: number;
  kind: Kind;
}

export interface DueReminder extends Reminder {
  installId: string;
}

export interface Store {
  getInstall(id: string): Promise<Install | null>;
  putInstall(install: Install): Promise<void>;
  replaceReminders(installId: string, list: Reminder[]): Promise<void>;
  deleteInstall(id: string): Promise<void>;
  /** Reminders due at or before `now`, earliest first. */
  due(now: number, limit: number): Promise<DueReminder[]>;
  deleteReminder(installId: string, rid: string): Promise<void>;
  /** Installs with no reminders left and no contact since `before`. */
  staleInstalls(before: number): Promise<string[]>;
  /** Counts one request against `key` in the window starting at `windowStart`; returns the new count. */
  countHit(key: string, windowStart: number): Promise<number>;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSender {
  send(target: PushTarget, payload: string): Promise<'sent' | 'gone' | 'failed'>;
}
