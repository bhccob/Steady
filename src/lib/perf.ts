import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * 'solid' swaps every BlurView for a pre-composited translucent layer.
 * The startup perf probe flips this when the frame budget is tight (spec §10.3).
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

const MIN_SAMPLES = 20;
/** Slower than about 40fps. */
const SLOW_FRAME_MS = 25;
const MAX_SLOW_SHARE = 0.25;
const MAX_MEDIAN_MS = 20;
const PROBE_FRAMES = 60;
/** Let the first screen settle before measuring. */
const PROBE_DELAY_MS = 800;

/** Blur stays on unless many frames ran slow, or frames were steadily too long. */
export function chooseGlassMode(frameMs: readonly number[]): GlassMode {
  if (frameMs.length < MIN_SAMPLES) return 'blur';
  const sorted = [...frameMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const slowShare = frameMs.filter((d) => d > SLOW_FRAME_MS).length / frameMs.length;
  return slowShare > MAX_SLOW_SHARE || median > MAX_MEDIAN_MS ? 'solid' : 'blur';
}

/** Measures about a second of frames once at launch and picks blur or the solid stand-in. */
export function usePerfProbe(): void {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let cancelled = false;
    const frames: number[] = [];
    const tick = (t: number) => {
      if (cancelled) return;
      if (last) frames.push(t - last);
      last = t;
      if (frames.length < PROBE_FRAMES) raf = requestAnimationFrame(tick);
      else usePerf.getState().setGlassMode(chooseGlassMode(frames));
    };
    const start = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, PROBE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, []);
}
