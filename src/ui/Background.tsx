import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';

const GLOW_AT = ['circle at 0% 0%', 'circle at 100% 35%', 'circle at 10% 78%', 'circle at 100% 100%'];

/** Light gray base with four soft beige glows, so glass on top has something to frost. */
export function Background({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const [a, b, c] = theme.background;
  const glows = theme.glows.map((g, i) => `radial-gradient(${GLOW_AT[i]}, ${g}, transparent 55%)`).join(', ');

  return (
    <View style={[styles.fill, { backgroundColor: a, backgroundImage: `${glows}, linear-gradient(135deg, ${a}, ${b}, ${c})` }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
