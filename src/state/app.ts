import { create } from 'zustand';

import type { SupportLevel } from '../db/schema';

interface AppState {
  supportLevel: SupportLevel;
  /** The reach-out sheet, opened from the emergency button or after a rough check-in. */
  help: null | 'button' | 'rough';
  /** Bumped when data changes outside a screen (a notification button), so screens reload. */
  dataVersion: number;
  setSupportLevel: (l: SupportLevel) => void;
  openHelp: (reason: 'button' | 'rough') => void;
  closeHelp: () => void;
  bumpData: () => void;
}

export const useApp = create<AppState>((set) => ({
  supportLevel: 'light',
  help: null,
  dataVersion: 0,
  setSupportLevel: (supportLevel) => set({ supportLevel }),
  openHelp: (help) => set({ help }),
  closeHelp: () => set({ help: null }),
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
