import type { GlassMode } from '../lib/perf';

// The background's four soft glows, each drifting and breathing on its own slow cycle so the
// movement never visibly repeats. Calm by design: a few percent of the screen, never faster.

export interface AmbientLayer {
  /** Where the glow's centre sits on screen, as shares of the width and height. */
  x: number;
  y: number;
  /** One full cycle, there and back. */
  periodMs: number;
  /** Drift to either side, as a share of the screen's width and height. */
  dx: number;
  dy: number;
  /** Scale at the far end of the cycle. */
  grow: number;
  /** How much the glow dims at the near end of the cycle. */
  breathe: number;
  /** How far the layer reaches past each edge, so drifting never shows its border. */
  bleed: number;
}

export const AMBIENT_LAYERS: readonly AmbientLayer[] = [
  { x: 0, y: 0, periodMs: 23000, dx: 0.03, dy: 0.025, grow: 1.08, breathe: 0.15, bleed: 0.06 },
  { x: 1, y: 0.35, periodMs: 29000, dx: -0.035, dy: 0.02, grow: 1.06, breathe: 0.12, bleed: 0.06 },
  { x: 0.1, y: 0.78, periodMs: 31000, dx: 0.025, dy: -0.03, grow: 1.07, breathe: 0.15, bleed: 0.06 },
  { x: 1, y: 1, periodMs: 37000, dx: -0.02, dy: -0.025, grow: 1.05, breathe: 0.1, bleed: 0.06 },
];

/** The radial-gradient position inside the oversized layer that puts the glow at its spot on screen. */
export function gradientPosition(layer: AmbientLayer): string {
  const pct = (v: number) => `${+(((v + layer.bleed) / (1 + 2 * layer.bleed)) * 100).toFixed(2)}%`;
  return `circle at ${pct(layer.x)} ${pct(layer.y)}`;
}

/** The glow only moves with full motion allowed and on a phone fast enough for real blur. */
export function ambientOn(reduced: boolean, glassMode: GlassMode): boolean {
  return !reduced && glassMode === 'blur';
}

/** A layer's pose at `t` from 0 to 1 through half a cycle; easing comes from the animation. */
export function ambientAt(layer: AmbientLayer, t: number, view: { width: number; height: number }) {
  return {
    translateX: layer.dx * view.width * (2 * t - 1),
    translateY: layer.dy * view.height * (2 * t - 1),
    scale: 1 + (layer.grow - 1) * t,
    opacity: 1 - layer.breathe * (1 - t),
  };
}
