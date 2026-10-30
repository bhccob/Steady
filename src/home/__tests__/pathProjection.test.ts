import { blockRadius, blockSize, hitTest, PATH, project, zigzag } from '../pathProjection';

const VIEW = { width: 390, height: 262 };

describe('blocks', () => {
  it('draws day blocks at 68 and trophies at 76', () => {
    expect(blockSize('day')).toBe(68);
    expect(blockSize('trophy')).toBe(76);
  });

  it('rounds a block fully: its radius is half its drawn height', () => {
    const size = blockSize('day');
    expect(blockRadius(size)).toBeCloseTo((size * PATH.faceRatio + PATH.side3d) / 2);
  });

  it('keeps the blocks you can see from overlapping, even a trophy behind a day', () => {
    const view = { width: 390, height: 292 };
    for (let k = 0; k < 4; k++) {
      const near = project(k * PATH.step, zigzag(k), view);
      const far = project((k + 1) * PATH.step, zigzag(k + 1), view);
      if (far.opacity < 0.3) break;
      const nearTop = near.y - (blockSize('day') * PATH.faceRatio * near.scale) / 2;
      const farBottom = far.y + ((blockSize('trophy') * PATH.faceRatio) / 2 + PATH.side3d) * far.scale;
      expect(farBottom).toBeLessThanOrEqual(nearTop);
    }
  });

  it('counts a tap near the edge of the bigger block', () => {
    const p = project(0, zigzag(0), VIEW);
    const tap = { x: p.x + 36 * p.scale, y: p.y };
    expect(hitTest(tap, { position: 0, count: 1, sizeOf: () => blockSize('day'), view: VIEW })).toBe(0);
    expect(hitTest(tap, { position: 0, count: 1, sizeOf: () => 60, view: VIEW })).toBeNull();
  });
});

describe('project', () => {
  it('rests the focus block in the lower part of the hero', () => {
    const p = project(0, 0, VIEW);
    expect(p.y).toBeGreaterThan(VIEW.height * 0.6);
    expect(p.y).toBeLessThan(VIEW.height);
    expect(p.scale).toBeGreaterThan(0.7);
    expect(p.scale).toBeLessThanOrEqual(1);
    expect(p.opacity).toBe(1);
  });

  it('draws blocks further along the path higher, smaller and closer to the middle', () => {
    let prev = project(0, 30, VIEW);
    for (let k = 1; k <= 6; k++) {
      const p = project(k * PATH.step, 30, VIEW);
      expect(p.y).toBeLessThan(prev.y);
      expect(p.scale).toBeLessThan(prev.scale);
      expect(Math.abs(p.x - VIEW.width / 2)).toBeLessThan(Math.abs(prev.x - VIEW.width / 2));
      prev = p;
    }
  });

  it('draws earlier blocks lower and bigger', () => {
    const focus = project(0, 0, VIEW);
    const before = project(-PATH.step, 0, VIEW);
    expect(before.y).toBeGreaterThan(focus.y);
    expect(before.scale).toBeGreaterThan(focus.scale);
  });

  it('fades blocks out toward the top and past the bottom edge', () => {
    expect(project(12 * PATH.step, 0, VIEW).opacity).toBe(0);
    expect(project(-3 * PATH.step, 0, VIEW).opacity).toBe(0);
    const mid = project(2 * PATH.step, 0, VIEW).opacity;
    expect(mid).toBeGreaterThan(0.5);
  });

  it('places the path right of centre, leaving room for the streak text', () => {
    expect(project(0, 0, VIEW).x).toBeGreaterThan(VIEW.width * 0.6);
  });
});

describe('zigzag', () => {
  it('weaves left and right and repeats every eight blocks', () => {
    expect(zigzag(0)).toBe(0);
    expect(zigzag(2)).toBeGreaterThan(0);
    expect(zigzag(6)).toBeLessThan(0);
    expect(zigzag(8)).toBe(zigzag(0));
  });
});

describe('hitTest', () => {
  const sizeOf = () => 60;

  it('finds the block drawn under the finger', () => {
    for (const i of [4, 5, 6]) {
      const p = project((i - 4) * PATH.step, zigzag(i), VIEW);
      expect(hitTest({ x: p.x, y: p.y }, { position: 4, count: 10, sizeOf, view: VIEW })).toBe(i);
    }
  });

  it('follows the path as it moves', () => {
    const p = project(0, zigzag(7), VIEW);
    expect(hitTest({ x: p.x, y: p.y }, { position: 7, count: 10, sizeOf, view: VIEW })).toBe(7);
  });

  it('finds nothing in empty space or on faded blocks', () => {
    expect(hitTest({ x: 20, y: 20 }, { position: 4, count: 10, sizeOf, view: VIEW })).toBeNull();
    const gone = project(12 * PATH.step, zigzag(16), VIEW);
    expect(hitTest({ x: gone.x, y: gone.y }, { position: 4, count: 20, sizeOf, view: VIEW })).toBeNull();
  });
});
