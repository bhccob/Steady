import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { usePerf } from '../lib/perf';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useTheme } from '../theme/useTheme';
import { AMBIENT_LAYERS, ambientAt, ambientOn, gradientPosition, type AmbientLayer } from './ambient';

/**
 * The web's Background: the same four glows as Background.tsx, moved by CSS keyframe animations
 * (react-native-web's animationKeyframes), so the browser runs them with no script per frame.
 */
export function Background({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const glassMode = usePerf((s) => s.glassMode);
  const moving = ambientOn(reduced, glassMode);
  const [a, b, c] = theme.background;

  return (
    <View style={[styles.fill, { backgroundColor: a, backgroundImage: `linear-gradient(135deg, ${a}, ${b}, ${c})` }]}>
      {AMBIENT_LAYERS.map((layer, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.layer,
            { inset: `${-layer.bleed * 100}%`, backgroundImage: `radial-gradient(${gradientPosition(layer)}, ${theme.glows[i]}, transparent 55%)` },
            moving ? DRIFT[i] : null,
          ]}
        />
      ))}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

/** One half-cycle there, then back (alternate); started part-way so the layers never move in step. */
function drift(layer: AmbientLayer, i: number): ViewStyle {
  // CSS translate percentages are of the layer itself, which is the screen plus its bleed.
  const pct = (d: number, t: number) => `${((d * (2 * t - 1)) / (1 + 2 * layer.bleed)) * 100}%`;
  const pose = (t: number) => {
    const p = ambientAt(layer, t, { width: 1, height: 1 });
    return { opacity: p.opacity, transform: [{ translateX: pct(layer.dx, t) }, { translateY: pct(layer.dy, t) }, { scale: p.scale }] };
  };
  const half = layer.periodMs / 2;
  return {
    animationKeyframes: [{ '0%': pose(0), '100%': pose(1) }],
    animationDuration: `${half}ms`,
    animationDelay: `${-(i / AMBIENT_LAYERS.length) * half}ms`,
    animationDirection: 'alternate',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  } as unknown as ViewStyle;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { position: 'absolute' },
});

// react-native-web only turns keyframes into CSS inside StyleSheet.create (inline styles drop them).
const DRIFT = AMBIENT_LAYERS.map((layer, i) => StyleSheet.create({ drift: drift(layer, i) }).drift);
