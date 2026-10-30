import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { haloShadow } from './glow';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A warm halo around its parent, drawn once; only its opacity animates (never the shadow, which
 * Android would repaint every frame). The parent must not clip, and the halo comes first so the
 * parent's content sits on top of it.
 */
export function GlowHalo({ on, radius, durationMs }: { on: boolean; radius: number; durationMs: number }) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    const fade = Animated.timing(opacity, { toValue: on ? 1 : 0, duration: durationMs, easing: EASE_OUT, useNativeDriver: Platform.OS !== 'web' });
    fade.start();
    return () => fade.stop();
  }, [on, durationMs, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: haloShadow(theme), opacity }]}
    />
  );
}
