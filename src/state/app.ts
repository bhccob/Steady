import { create } from 'zustand';

import type { MedForm, SupportLevel } from '../db/schema';

/** A pill just added: Home shows it once, glowing in its colour, with when its first reminder comes. */
export interface JustAdded {
  medId: string;
  note: string;
  colour: string;
  form: MedForm;
  /** When it was added (ms), so an old note is never shown. */
  at: number;
}

/** Signed in with email: who, when the backup last saved, and whether this device holds it. */
export interface AccountState {
  email: string;
  savedAt: number | null;
  /** ok: backing up. elsewhere: another device took the backup over. offline: will retry. */
  state: 'ok' | 'elsewhere' | 'offline';
}

/** Why the reach-out sheet opened: the button, a rough check-in, or a dose left open (Steady and Close). */
export type HelpReason = 'button' | 'rough' | 'overdue';

interface AppState {
  supportLevel: SupportLevel;
  help: null | HelpReason;
  /** Bumped when data changes outside a screen (a notification button), so screens reload. */
  dataVersion: number;
  /** The crisis line region the user picked; null follows the phone. */
  crisisRegion: string | null;
  /** Face or fingerprint lock, and hiding the app in the app switcher. */
  privacy: { lock: boolean; hide: boolean };
  /** A dose is more than two hours overdue: the emergency button grows more visible (spec §7.1). */
  longOverdue: boolean;
  /** The "Add a pill" sheet: null when closed, with uid=197609(bhcco) gid=197609 groups=197609 when changing a pill. */
  pillSheet: null | { id?: string };
  justAdded: JustAdded | null;
  /** Null when not signed in. */
  account: AccountState | null;
  setAccount: (a: AccountState | null) => void;
  /** Backs up now (set by AccountBridge; does nothing until it mounts). */
  backupNow: () => Promise<void>;
  openPillSheet: (id?: string) => void;
  closePillSheet: () => void;
  setJustAdded: (j: JustAdded | null) => void;
  setLongOverdue: (v: boolean) => void;
  setSupportLevel: (l: SupportLevel) => void;
  setCrisisRegion: (r: string | null) => void;
  setPrivacy: (p: { lock: boolean; hide: boolean }) => void;
  openHelp: (reason: HelpReason) => void;
  closeHelp: () => void;
  bumpData: () => void;
}

export const useApp = create<AppState>((set) => ({
  supportLevel: 'light',
  help: null,
  dataVersion: 0,
  crisisRegion: null,
  privacy: { lock: false, hide: false },
  longOverdue: false,
  pillSheet: null,
  justAdded: null,
  account: null,
  setAccount: (account) => set({ account }),
  backupNow: async () => {},
  openPillSheet: (id) => set({ pillSheet: id ? { id } : {} }),
  closePillSheet: () => set({ pillSheet: null }),
  setJustAdded: (justAdded) => set({ justAdded }),
  setLongOverdue: (longOverdue) => set({ longOverdue }),
  setSupportLevel: (supportLevel) => set({ supportLevel }),
  setCrisisRegion: (crisisRegion) => set({ crisisRegion }),
  setPrivacy: (privacy) => set({ privacy }),
  openHelp: (help) => set({ help }),
  closeHelp: () => set({ help: null }),
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
