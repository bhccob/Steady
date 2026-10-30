import { AMBIENT_LAYERS, ambientAt, ambientOn, gradientPosition } from '../ambient';

const VIEW = { width: 400, height: 800 };

describe('ambient glow', () => {
  it('has four layers on distinct 20-40 s cycles', () => {
    expect(AMBIENT_LAYERS).toHaveLength(4);
    const periods = AMBIENT_LAYERS.map((l) => l.periodMs);
    expect(new Set(periods).size).toBe(4);
    for (const p of periods) expect(p >= 20000 && p <= 40000).toBe(true);
  });

  it('stays within the calm limits and never shows an edge', () => {
    for (const l of AMBIENT_LAYERS) {
      expect(Math.abs(l.dx)).toBeLessThanOrEqual(0.04);
      expect(Math.abs(l.dy)).toBeLessThanOrEqual(0.04);
      expect(l.grow).toBeLessThanOrEqual(1.08);
      expect(l.breathe).toBeLessThanOrEqual(0.15);
      expect(l.bleed).toBeGreaterThanOrEqual(Math.max(Math.abs(l.dx), Math.abs(l.dy)));
    }
  });

  it('rests centred halfway through a cycle and reaches its extremes at the ends', () => {
    const l = AMBIENT_LAYERS[0]!;
    expect(ambientAt(l, 0.5, VIEW).translateX).toBeCloseTo(0);
    expect(ambientAt(l, 0, VIEW).translateX).toBeCloseTo(-l.dx * VIEW.width);
    expect(ambientAt(l, 1, VIEW).translateX).toBeCloseTo(l.dx * VIEW.width);
    expect(ambientAt(l, 1, VIEW).scale).toBeCloseTo(l.grow);
    expect(ambientAt(l, 0, VIEW).opacity).toBeCloseTo(1 - l.breathe);
    expect(ambientAt(l, 1, VIEW).opacity).toBeCloseTo(1);
  });

  it('keeps each glow where it was on screen, though its layer is drawn oversized', () => {
    const l = { ...AMBIENT_LAYERS[0]!, x: 0, y: 1, bleed: 0.06 };
    expect(gradientPosition(l)).toBe('circle at 5.36% 94.64%');
  });

  it('only moves with full motion on a capable device', () => {
    expect(ambientOn(false, 'blur')).toBe(true);
    expect(ambientOn(true, 'blur')).toBe(false);
    expect(ambientOn(false, 'solid')).toBe(false);
  });
});
