/** 4-7-8 breathing (spec §6.4): in for 4, hold for 7, out for 8. */
const PHASES = [
  { phase: 'in', ms: 4_000 },
  { phase: 'hold', ms: 7_000 },
  { phase: 'out', ms: 8_000 },
] as const;
const CYCLE_MS = PHASES.reduce((s, p) => s + p.ms, 0);
const CYCLES = 3;

/** Three full breaths: about a minute. */
export const BREATH_TOTAL_MS = CYCLE_MS * CYCLES;

export type BreathPhase = 'in' | 'hold' | 'out' | 'done';

/** Where the exercise is `elapsedMs` after it starts. `progress` runs 0 to 1 through the current phase. */
export function breathAt(elapsedMs: number): { phase: BreathPhase; secondsLeft: number; progress: number; cycle: number } {
  if (elapsedMs >= BREATH_TOTAL_MS) return { phase: 'done', secondsLeft: 0, progress: 1, cycle: CYCLES };
  const cycle = Math.floor(elapsedMs / CYCLE_MS) + 1;
  let t = elapsedMs % CYCLE_MS;
  for (const p of PHASES) {
    if (t < p.ms) return { phase: p.phase, secondsLeft: Math.ceil((p.ms - t) / 1000), progress: t / p.ms, cycle };
    t -= p.ms;
  }
  return { phase: 'done', secondsLeft: 0, progress: 1, cycle: CYCLES };
}
