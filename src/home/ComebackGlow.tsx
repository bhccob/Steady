import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { useTheme } from '../theme/useTheme';

const BLOOM_MS = 900;

/**
 * Spec §9.4: a comeback gets the loudest moment in the app. A warm glow blooms twice behind the
 * streak number. Under Reduce Motion it doesn't play; the words and the haptic still do.
 */
export function ComebackGlow({ play }: { play: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!play || reduced) return;
    t.setValue(0);
    const bloom = Animated.timing(t, { toValue: 1, duration: BLOOM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    Animated.sequence([bloom, Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }), bloom]).start();
  }, [play, reduced, t]);

  if (!play || reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.glow,
        {
          backgroundColor: theme.accent,
          boxShadow: `0px 0px 40px 20px ${theme.accent}`,
          opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.85, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 10, top: 0, width: 110, height: 110, borderRadius: 999 },
});
