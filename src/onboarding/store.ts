import { create } from 'zustand';

import { emptyDraft, newDraftMed, type DraftMed, type OnboardingDraft } from './draft';

interface OnboardingState {
  draft: OnboardingDraft;
  patch: (p: Partial<OnboardingDraft>) => void;
  addMed: () => void;
  updateMed: (key: string, p: Partial<DraftMed>) => void;
  removeMed: (key: string) => void;
  reset: () => void;
}

/** Holds onboarding answers in memory until the last step saves them. */
export const useOnboarding = create<OnboardingState>((set) => ({
  draft: emptyDraft(),
  patch: (p) => set((s) => ({ draft: { ...s.draft, ...p } })),
  addMed: () => set((s) => ({ draft: { ...s.draft, meds: [...s.draft.meds, newDraftMed()] } })),
  updateMed: (key, p) =>
    set((s) => ({ draft: { ...s.draft, meds: s.draft.meds.map((m) => (m.key === key ? { ...m, ...p } : m)) } })),
  removeMed: (key) => set((s) => ({ draft: { ...s.draft, meds: s.draft.meds.filter((m) => m.key !== key) } })),
  reset: () => set({ draft: emptyDraft() }),
}));
