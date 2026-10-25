import { composite, contrastRatio, parseColor, toHsl } from '../test-utils/color';
import { themes, type Theme } from './tokens';

describe('color math sanity', () => {
  it('measures black on white as 21:1', () => {
    expect(contrastRatio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21, 1);
  });

  it('measures #777 on white just under AA', () => {
    expect(contrastRatio(parseColor('#777777'), parseColor('#ffffff'))).toBeCloseTo(4.48, 2);
  });
});

const AA_BODY = 4.5;
const AA_NON_TEXT = 3;

// What a glass card can sit on: each background stop, alone and under each soft glow.
function backdrops(t: Theme): { label: string; layers: string[] }[] {
  return t.background.flatMap((stop) => [
    { label: stop, layers: [stop] },
    ...t.glows.map((glow) => ({ label: `${stop} + ${glow}`, layers: [stop, glow] })),
  ]);
}

// Layer stack under text, bottom to top. Blur is decoration; the core carries text.
function coreStack(t: Theme, backdrop: string[], mode: 'blur' | 'solid'): string[] {
  return mode === 'solid'
    ? [...backdrop, t.glass.solid, t.glass.overlay, t.glass.core]
    : [...backdrop, t.glass.overlay, t.glass.core];
}

describe.each(Object.values(themes))('$name theme contrast', (t) => {
  const cases = backdrops(t).flatMap(({ label, layers }) =>
    (['blur', 'solid'] as const).map((mode) => ({ backdrop: label, layers, mode })),
  );

  it.each(cases)('primary text passes AA on glass over $backdrop ($mode)', ({ layers, mode }) => {
    const stack = coreStack(t, layers, mode);
    const surface = composite(stack);
    const text = composite([...stack, t.text.primary]);
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(cases)('secondary text passes AA on glass over $backdrop ($mode)', ({ layers, mode }) => {
    const stack = coreStack(t, layers, mode);
    const surface = composite(stack);
    const text = composite([...stack, t.text.secondary]);
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(cases)('the accent outline reads as a control edge on glass over $backdrop ($mode)', ({ layers, mode }) => {
    const surface = composite(coreStack(t, layers, mode));
    expect(contrastRatio(parseColor(t.accentLine), surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(t.background.map((stop) => ({ stop })))('the accent outline reads against the bare background $stop', ({ stop }) => {
    expect(contrastRatio(parseColor(t.accentLine), parseColor(stop))).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('text on an accent fill passes AA', () => {
    expect(contrastRatio(parseColor(t.onAccent), parseColor(t.accent))).toBeGreaterThanOrEqual(AA_BODY);
  });
});

function colorStrings(value: unknown): string[] {
  if (typeof value === 'string') return /^(#|rgb|hsl)/i.test(value) ? [value] : [];
  if (value && typeof value === 'object') return Object.values(value).flatMap(colorStrings);
  return [];
}

describe.each(Object.values(themes))('$name theme chart shades', (t) => {
  const surface = parseColor(t.background[0]);
  const ratios = t.chart.steps.map((c) => contrastRatio(parseColor(c), surface));

  it('every shade stands out from the background by at least 2:1', () => {
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(2);
  });

  it('runs from strongest (on time) to faintest, so order reads without a legend', () => {
    expect(ratios[0]).toBeGreaterThan(ratios[1]!);
    expect(ratios[1]).toBeGreaterThan(ratios[2]!);
  });
});

describe('palette has no red', () => {
  const all = Object.values(themes).flatMap(colorStrings);

  it('finds the colors it is checking', () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it.each(all)('%s is not a red', (c) => {
    const { h, s, l } = toHsl(parseColor(c));
    const reddish = (h >= 345 || h <= 15) && s >= 0.4 && l >= 0.2 && l <= 0.8;
    expect(reddish).toBe(false);
  });
});
