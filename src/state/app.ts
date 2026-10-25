import { create } from 'zustand';

import type { SupportLevel } from '../db/schema';

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
  setSupportLevel: (supportLevel) => set({ supportLevel }),
  setCrisisRegion: (crisisRegion) => set({ crisisRegion }),
  setPrivacy: (privacy) => set({ privacy }),
  openHelp: (help) => set({ help }),
  closeHelp: () => set({ help: null }),
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
