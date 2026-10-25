import { Pressable, StyleSheet, View } from 'react-native';

import { formatHm, stepMinutes } from '../lib/time';
import { HAIRLINE, layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';
import { AppText } from './Text';

interface TimeStepperProps {
  label: string;
  /** Minutes after midnight. */
  value: number;
  onChange: (min: number) => void;
  step?: number;
  onRemove?: () => void;
}

/** A clock time with minus and plus, in 15-minute steps by default. */
export function TimeStepper({ label, value, onChange, step = 15, onRemove }: TimeStepperProps) {
  const theme = useTheme();
  const round = [styles.round, { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border }];
  return (
    <View style={styles.row}>
      <AppText style={styles.grow}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${step} minutes earlier`} onPress={() => onChange(stepMinutes(value, -step))} style={round}>
        <Icon name="minus" size={18} />
      </Pressable>
      <AppText
        variant="heading"
        style={styles.value}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, ${formatHm(value)}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(stepMinutes(value, e.nativeEvent.actionName === 'increment' ? step : -step))}
      >
        {formatHm(value)}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${step} minutes later`} onPress={() => onChange(stepMinutes(value, step))} style={round}>
        <Icon name="plus" size={18} />
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${formatHm(value)}`} onPress={onRemove} style={styles.remove}>
          <Icon name="x" size={18} color={theme.text.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
  round: { width: layout.minTarget, height: layout.minTarget, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 64, textAlign: 'center', fontSize: 22 },
  remove: { width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center' },
});
