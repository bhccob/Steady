import type { TextStyle } from 'react-native';

// Warm beige over light gray. Colour stays quiet and only marks what matters.
// There is no error or red token in this palette, on purpose. Do not add one.

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  /** Base gradient stops, painted at 135deg. Never pure white or black. */
  background: readonly [string, string, string];
  /** Soft blurred colour glows behind glass: top-left, right, lower-left, bottom-right. */
  glows: readonly [string, string, string, string];
  text: { primary: string; secondary: string };
  /** Fill for primary buttons, marked blocks and finished days. */
  accent: string;
  /** The darker under-edge that gives accent fills their 3D press. */
  accentDeep: string;
  /** Outlines and strokes that must read at 3:1 (today ring, calendar rings). */
  accentLine: string;
  /** Text and icons on an accent fill. */
  onAccent: string;
  glass: {
    blurIntensity: number;
    overlay: string;
    border: string;
    /** Layer every piece of text sits on. Carries contrast. */
    core: string;
    /** Pre-composited stand-in for the blur when the perf probe turns blur off. */
    solid: string;
    shadow: string;
  };
  /** Insights charts. One beige hue, strongest to faintest: on time, a bit later, partly marked. */
  chart: {
    steps: readonly [string, string, string];
    /** "Not marked": a quiet neutral, always labelled. */
    none: string;
    /** Hairline gridlines and axes. */
    grid: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: 'light',
    background: ['#F5F3EF', '#F3EEE6', '#EEEAE4'],
    glows: ['rgba(238, 220, 192, 0.95)', 'rgba(229, 226, 220, 0.9)', 'rgba(234, 216, 188, 0.6)', 'rgba(244, 234, 219, 0.9)'],
    text: { primary: '#1B1613', secondary: 'rgba(27, 22, 19, 0.66)' },
    accent: '#E8D5B5',
    accentDeep: '#CDB38C',
    accentLine: '#9A7D52',
    onAccent: '#1B1613',
    glass: {
      blurIntensity: 34,
      overlay: 'rgba(255, 255, 255, 0.42)',
      border: 'rgba(255, 255, 255, 0.75)',
      core: 'rgba(255, 253, 250, 0.35)',
      solid: 'rgba(250, 247, 242, 0.92)',
      shadow: '0px 12px 40px rgba(60, 60, 40, 0.08)',
    },
    chart: { steps: ['#7F6440', '#A88A5C', '#C4A577'], none: '#D6D1C9', grid: 'rgba(27, 22, 19, 0.1)' },
  },
  dark: {
    name: 'dark',
    background: ['#161310', '#1C1814', '#221D18'],
    glows: ['rgba(205, 179, 140, 0.16)', 'rgba(120, 110, 95, 0.14)', 'rgba(205, 179, 140, 0.10)', 'rgba(160, 140, 110, 0.10)'],
    text: { primary: '#F3ECE2', secondary: 'rgba(243, 236, 226, 0.68)' },
    accent: '#D9C29C',
    accentDeep: '#A8916A',
    accentLine: '#CDB38C',
    onAccent: '#1B1613',
    glass: {
      blurIntensity: 26,
      overlay: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.12)',
      core: 'rgba(28, 24, 20, 0.6)',
      solid: 'rgba(34, 29, 24, 0.92)',
      shadow: '0px 12px 40px rgba(0, 0, 0, 0.35)',
    },
    chart: { steps: ['#D9C29C', '#A8916A', '#6F5F45'], none: '#3E3832', grid: 'rgba(243, 236, 226, 0.12)' },
  },
};

export const radius = { card: 28, control: 16, pill: 999 } as const;

/** Weights 400 and 600 only. */
export const typeScale = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: -0.5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

/** Dynamic Type ceiling: 200%. */
export const MAX_FONT_SCALE = 2;
/**
 * For decorative text inside a fixed shape (path tiles, medals, chart labels). Each of these has
 * a full spoken label, and the same information appears in scaled text nearby.
 */
export const DECOR_FONT_SCALE = 1.3;

export const layout = {
  maxContentWidth: 560,
  gutter: 20,
  minTarget: 44,
  doseButtonHeight: 56,
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 140, mass: 0.9 },
  reducedCrossfadeMs: 180,
  pageTransitionMs: 260,
} as const;
