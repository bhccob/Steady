import { chooseGlassMode } from '../perf';

const frames = (ms: number, n = 60) => Array.from({ length: n }, () => ms);

describe('chooseGlassMode', () => {
  it('keeps real blur on a phone that holds 60fps', () => {
    expect(chooseGlassMode(frames(16.7))).toBe('blur');
  });

  it('keeps blur through the odd slow frame', () => {
    expect(chooseGlassMode([...frames(16.7, 54), ...frames(40, 6)])).toBe('blur');
  });

  it('switches to the solid stand-in when many frames run slow', () => {
    expect(chooseGlassMode([...frames(16.7, 40), ...frames(34, 20)])).toBe('solid');
  });

  it('switches when frames are steadily too long', () => {
    expect(chooseGlassMode(frames(24))).toBe('solid');
  });

  it('keeps blur when there were too few frames to judge', () => {
    expect(chooseGlassMode(frames(50, 5))).toBe('blur');
  });
});
