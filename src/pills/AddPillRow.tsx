import { StyleSheet, View } from 'react-native';

import { radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { GlowPressable } from '../ui/GlowPressable';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

/** The "Add a pill" row under today's pills on Home: always there, never in the way. */
export function AddPillRow({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <GlowPressable
      radius={radius.card}
      accessibilityRole="button"
      accessibilityLabel="Add a pill"
      accessibilityHint="Meds, vitamins or supplements"
      onPress={onPress}
      style={[styles.row, { borderColor: theme.accentDeep, backgroundColor: theme.glass.overlay }]}
    >
      <View style={[styles.plus, { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep }]}>
        <Icon name="plus" size={20} color={theme.onAccent} />
      </View>
      <View style={styles.grow}>
        <AppText variant="bodyStrong">Add a pill</AppText>
        <AppText variant="caption" tone="secondary">
          meds, vitamins or supplements
        </AppText>
      </View>
    </GlowPressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed' },
  plus: { width: 38, height: 38, borderRadius: 99, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
});
