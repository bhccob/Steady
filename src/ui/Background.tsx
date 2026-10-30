import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { usePerf } from '../lib/perf';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useTheme } from '../theme/useTheme';
import { AMBIENT_LAYERS, ambientAt, ambientOn, gradientPosition } from './ambient';

type Size = { width: number; height: number };

/**
 * Light gray base with four soft beige glows, so glass on top has something to frost. Each glow
 * drifts and breathes on its own slow cycle (ambient.ts); it holds still under Reduce Motion and
 * on phones too slow for real blur.
 */
export function Background({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const glassMode = usePerf((s) => s.glassMode);
  const moving = ambientOn(reduced, glassMode);
  const [view, setView] = useState<Size | null>(null);
  // Each layer starts at a different point of its cycle, so they never move in step.
  const [phases] = useState(() => AMBIENT_LAYERS.map((_, i) => new Animated.Value(i / AMBIENT_LAYERS.length)));
  const [a, b, c] = theme.background;

  useEffect(() => {
    if (!moving) return;
    const loops = AMBIENT_LAYERS.map((layer, i) => {
      const leg = (toValue: number) =>
        Animated.timing(phases[i]!, { toValue, duration: layer.periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' });
      return Animated.loop(Animated.sequence([leg(1), leg(0)]), { iterations: -1, resetBeforeIteration: false });
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [moving, phases]);

  return (
    <View
      style={[styles.fill, { backgroundColor: a, backgroundImage: `linear-gradient(135deg, ${a}, ${b}, ${c})` }]}
      onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {AMBIENT_LAYERS.map((layer, i) => {
        const pose = moving && view ? motionStyle(phases[i]!, layer, view) : null;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.layer,
              { inset: `${-layer.bleed * 100}%`, backgroundImage: `radial-gradient(${gradientPosition(layer)}, ${theme.glows[i]}, transparent 55%)` },
              pose,
            ]}
          />
        );
      })}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

function motionStyle(phase: Animated.Value, layer: (typeof AMBIENT_LAYERS)[number], view: Size) {
  const from = ambientAt(layer, 0, view);
  const to = ambientAt(layer, 1, view);
  const along = (key: keyof typeof from) => phase.interpolate({ inputRange: [0, 1], outputRange: [from[key], to[key]] });
  return {
    opacity: along('opacity'),
    transform: [{ translateX: along('translateX') }, { translateY: along('translateY') }, { scale: along('scale') }],
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { position: 'absolute' },
});
