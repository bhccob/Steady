import type { Theme } from '../theme/tokens';

// The warm halo tappable things wear under a pointer, a finger or keyboard focus. Quick to
// appear on press (feedback must feel immediate), gentle to fade. Lift is a hover-only hint.

export const GLOW = { hoverInMs: 150, pressInMs: 100, outMs: 200, lift: 1 } as const;

export type GlowCause = 'hover' | 'press' | 'focus';

/** What the halo should do after `changed` switched on or off, given everything still holding it. */
export function glowTarget(active: ReadonlySet<GlowCause>, changed: GlowCause, reduced: boolean): { opacity: 0 | 1; durationMs: number; lift: number } {
  const durationMs = !active.has(changed) ? GLOW.outMs : changed === 'press' ? GLOW.pressInMs : GLOW.hoverInMs;
  return {
    opacity: active.size > 0 ? 1 : 0,
    durationMs,
    lift: active.has('hover') && !active.has('press') && !reduced ? GLOW.lift : 0,
  };
}

/** The halo itself: the theme's accent line, soft and wide. Drawn once; only its opacity moves. */
export function haloShadow(theme: Theme): string {
  const hex = theme.accentLine.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `0px 0px 20px 4px rgba(${r}, ${g}, ${b}, 0.38)`;
}
