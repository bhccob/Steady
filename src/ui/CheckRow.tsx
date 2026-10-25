import { Pressable, StyleSheet, View } from 'react-native';

import { HAIRLINE, layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';
import { AppText } from './Text';

/** A plain list row with a check circle. Hairline separated, no box. */
export function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.row, { borderBottomColor: HAIRLINE }]}
    >
      <AppText style={styles.grow}>{label}</AppText>
      <View
        style={[
          styles.circle,
          checked
            ? { backgroundColor: theme.accent, borderColor: theme.accentLine }
            : { backgroundColor: 'transparent', borderColor: theme.text.secondary },
        ]}
      >
        {checked ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: Math.max(layout.minTarget, 50), flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 12 },
  grow: { flex: 1 },
  circle: { width: 24, height: 24, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
