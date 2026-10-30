import { themes } from '../../theme/tokens';
import { GLOW, glowTarget, haloShadow, type GlowCause } from '../glow';

const on = (...c: GlowCause[]) => new Set(c);

describe('glowTarget', () => {
  it('shows quickly on press, without lifting', () => {
    expect(glowTarget(on('press'), 'press', false)).toEqual({ opacity: 1, durationMs: GLOW.pressInMs, lift: 0 });
  });
  it('fades in and lifts a pixel on hover', () => {
    expect(glowTarget(on('hover'), 'hover', false)).toEqual({ opacity: 1, durationMs: GLOW.hoverInMs, lift: 1 });
  });
  it('never lifts under Reduce Motion', () => {
    expect(glowTarget(on('hover'), 'hover', true).lift).toBe(0);
  });
  it('stays lit, and lifts again, when a press ends under the pointer', () => {
    expect(glowTarget(on('hover'), 'press', false)).toEqual({ opacity: 1, durationMs: GLOW.outMs, lift: 1 });
  });
  it('fades out when nothing holds it, including a press cancelled by a scroll', () => {
    expect(glowTarget(on(), 'press', false)).toEqual({ opacity: 0, durationMs: GLOW.outMs, lift: 0 });
  });
  it('shows for keyboard focus, without lifting', () => {
    expect(glowTarget(on('focus'), 'focus', false)).toEqual({ opacity: 1, durationMs: GLOW.hoverInMs, lift: 0 });
  });
});

describe('haloShadow', () => {
  it('uses each theme accent line, softly', () => {
    expect(haloShadow(themes.light)).toBe('0px 0px 20px 4px rgba(154, 125, 82, 0.38)');
    expect(haloShadow(themes.dark)).toBe('0px 0px 20px 4px rgba(205, 179, 140, 0.38)');
  });
});
