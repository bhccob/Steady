import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../theme/tokens';
import { Background } from './Background';

interface ScreenProps {
  children?: ReactNode;
  /** Scrolls by default so content grows with Dynamic Type instead of clipping. */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area aware single column, max 560dp wide. */
export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 24,
    paddingLeft: Math.max(layout.gutter, insets.left),
    paddingRight: Math.max(layout.gutter, insets.right),
  };
  const column = <View style={[styles.column, contentStyle]}>{children}</View>;

  return (
    <Background>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.center, padding]}>{column}</ScrollView>
      ) : (
        <View style={[styles.fill, styles.center, padding]}>{column}</View>
      )}
    </Background>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: 16 },
});
