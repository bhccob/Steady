import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../theme/tokens';
import { Background } from '../ui/Background';
import { AppText } from '../ui/Text';

/** Web only: Steady is open in another tab or window. This one opens by itself once that closes. */
export function OpenElsewhere() {
  const insets = useSafeAreaInsets();
  return (
    <Background>
      <View style={[styles.column, { paddingTop: insets.top + 48 }]}>
        <AppText variant="title" accessibilityRole="header">
          Steady is open somewhere else.
        </AppText>
        <AppText tone="secondary" style={styles.sub}>
          Close the other tab or window and Steady will open here. Your marks are safe.
        </AppText>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter },
  sub: { marginTop: 8 },
});
