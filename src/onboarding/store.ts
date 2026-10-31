import { create } from 'zustand';

import { emptyDraft, type OnboardingDraft } from './draft';

interface OnboardingState {
  draft: OnboardingDraft;
  patch: (p: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

/** Holds onboarding answers in memory until the last step saves them. */
export const useOnboarding = create<OnboardingState>((set) => ({
  draft: emptyDraft(),
  patch: (p) => set((s) => ({ draft: { ...s.draft, ...p } })),
  reset: () => set({ draft: emptyDraft() }),
}));
