import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { usePerf } from '../lib/perf';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { InsideCard } from './insideCard';

export type GlassVariant = 'card' | 'control' | 'pill';

const RADIUS: Record<GlassVariant, number> = {
  card: radius.card,
  control: radius.control,
  pill: radius.pill,
};

interface GlassProps extends ViewProps {
  variant?: GlassVariant;
  /**
   * Real backdrop blur. Budget is 3 blurred layers per screen and no nesting,
   * so only large surfaces opt in. Everything else gets the solid layer.
   */
  blur?: boolean;
  /** Width of the glass rim visible around the text core. */
  rim?: number;
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Glass card: blur (or its solid stand-in), a light overlay, a 1px border, and a
 * near-opaque inner core. All text goes inside the core so contrast passes AA
 * whatever is behind the card.
 */
export function Glass({ variant = 'card', blur = false, rim, style, contentStyle, children, ...rest }: GlassProps) {
  const theme = useTheme();
  const glassMode = usePerf((s) => s.glassMode);
  const r = RADIUS[variant];
  const rimWidth = rim ?? 0;

  return (
    <View style={[{ borderRadius: r, boxShadow: theme.glass.shadow }, style]} {...rest}>
      <View style={[styles.clip, { borderRadius: r, borderColor: theme.glass.border, padding: rimWidth }]}>
        {blur && glassMode === 'blur' ? (
          <BlurView intensity={theme.glass.blurIntensity} tint={theme.name} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.solid }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.overlay }]} />
        <View style={[{ borderRadius: Math.max(r - rimWidth, 0), backgroundColor: theme.glass.core }, contentStyle]}>
          <InsideCard.Provider value>{children}</InsideCard.Provider>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
