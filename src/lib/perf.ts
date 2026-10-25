import { create } from 'zustand';

/**
 * 'solid' swaps every BlurView for a pre-composited translucent layer.
 * The startup perf probe (build step 15) flips this when the frame budget is tight.
 */
export type GlassMode = 'blur' | 'solid';

interface PerfState {
  glassMode: GlassMode;
  setGlassMode: (mode: GlassMode) => void;
}

export const usePerf = create<PerfState>((set) => ({
  glassMode: 'blur',
  setGlassMode: (glassMode) => set({ glassMode }),
}));
