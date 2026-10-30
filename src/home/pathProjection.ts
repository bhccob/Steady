// The streak path's 3D look, done with plain 2D maths. Each block's place, size and fade
// come from projecting a plane tilted back by TILT_DEG through a PERSPECTIVE camera, so no
// view is ever rotated in 3D. Android renders, hit-tests and animates rotated views badly;
// flat views at computed positions behave the same on every phone.

export const PATH = {
  /** Distance between blocks along the plane: enough that the bigger blocks never overlap. */
  step: 138,
  perspective: 700,
  tiltDeg: 50,
  /** How far along the plane, from the bottom edge, the focus block sits. */
  anchorDepth: 110,
  /** The plane's near edge sits this far below the hero. */
  belowEdge: 30,
  /** Path centre as a share of the width; the streak text sits on the left. */
  side: 0.73,
  /** A block's face is drawn this much shorter than it is wide, as a tilted square looks. */
  faceRatio: 0.62,
  /** The block's thickness below its face, before perspective. */
  side3d: 9,
  /** Width of a day block, and of a week's trophy block. */
  blockSize: 68,
  trophySize: 76,
};

/** How wide a block is drawn, before perspective. Drawing and tapping both use this. */
export function blockSize(kind: 'day' | 'trophy'): number {
  return kind === 'trophy' ? PATH.trophySize : PATH.blockSize;
}

/** Corner radius that makes a block a full pill: half its drawn height, edge included. */
export function blockRadius(size: number): number {
  return (size * PATH.faceRatio + PATH.side3d) / 2;
}

const ZIGZAG = [0, 30, 44, 30, 0, -30, -44, -30];
const THETA = (PATH.tiltDeg * Math.PI) / 180;
/** Blocks fade out from here to here, in steps along the path. */
const FAR_START = 3 * PATH.step;
const FAR_END = 5 * PATH.step;
/** Blocks fade out past the bottom edge, over this many pixels. */
const BOTTOM_FADE = 30;
const MAX_SCALE = 3;
const HIT_SLOP = 4;
const MIN_HIT_OPACITY = 0.3;

export interface Viewport {
  width: number;
  height: number;
}

export interface Projection {
  /** Centre of the block's face. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

/** Sideways weave for block `i`, repeating every eight blocks. */
export function zigzag(i: number): number {
  return ZIGZAG[((i % ZIGZAG.length) + ZIGZAG.length) % ZIGZAG.length]!;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Where a block `rel` pixels along the path from the focus point appears (negative = before it). */
export function project(rel: number, zig: number, view: Viewport): Projection {
  const along = -(PATH.anchorDepth + rel);
  const z = along * Math.sin(THETA);
  const scale = Math.min(MAX_SCALE, PATH.perspective / (PATH.perspective - z));
  const x = view.width / 2 + (view.width * (PATH.side - 0.5) + zig) * scale;
  const y = view.height + PATH.belowEdge + along * Math.cos(THETA) * scale;
  const far = clamp01((FAR_END - rel) / (FAR_END - FAR_START));
  const near = clamp01((view.height + BOTTOM_FADE - y) / BOTTOM_FADE);
  return { x, y, scale, opacity: Math.min(far, near) };
}

/** The block drawn under `point`, the nearest one if they overlap, or null. Faded blocks can't be tapped. */
export function hitTest(
  point: { x: number; y: number },
  input: { position: number; count: number; sizeOf: (i: number) => number; view: Viewport },
): number | null {
  let hit: number | null = null;
  for (let i = 0; i < input.count; i++) {
    const p = project((i - input.position) * PATH.step, zigzag(i), input.view);
    if (p.opacity < MIN_HIT_OPACITY) continue;
    const size = input.sizeOf(i) * p.scale;
    const faceH = size * PATH.faceRatio;
    const inX = Math.abs(point.x - p.x) <= size / 2 + HIT_SLOP;
    const inY = point.y >= p.y - faceH / 2 - HIT_SLOP && point.y <= p.y + faceH / 2 + PATH.side3d * p.scale + HIT_SLOP;
    // Nearer blocks are drawn on top, and nearer means a lower index.
    if (inX && inY && (hit === null || i < hit)) hit = i;
  }
  return hit;
}

/** Positions along the path (relative to the focus) sampled for native-driver interpolation. */
export function sampleRange(): number[] {
  const out: number[] = [];
  for (let rel = -3 * PATH.step; rel <= 9 * PATH.step; rel += PATH.step / 4) out.push(rel);
  return out;
}
