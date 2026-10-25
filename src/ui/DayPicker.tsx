import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

/** Weeks start on Monday on screen; storage keeps 0 = Sunday. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL = [0, 1, 2, 3, 4, 5, 6];

/** Empty means every day. The last day can't be turned off. */
function toggleDay(days: readonly number[], d: number): number[] {
  const current = days.length ? days : ALL;
  const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d].sort();
  if (next.length === 0) return [...days];
  return next.length === 7 ? [] : next;
}

/** Seven round day toggles, Monday first, with "Every day" or "N days a week" under them. */
export function DayPicker({ days, onChange }: { days: readonly number[]; onChange: (days: number[]) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.days}>
        {WEEK.map((d) => {
          const on = days.length === 0 || days.includes(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="checkbox"
              accessibilityLabel={NAME[d]}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(toggleDay(days, d))}
              style={[
                styles.day,
                on ? { backgroundColor: theme.accent, borderColor: theme.accentLine } : { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border },
              ]}
            >
              <AppText variant="bodyStrong" style={[styles.dayText, on && { color: theme.onAccent }]}>
                {LETTER[d]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" tone="secondary">
        {days.length === 0 ? 'Every day' : `${days.length} days a week`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  days: { flexDirection: 'row', gap: 4, marginTop: 4 },
  day: { flex: 1, maxWidth: 48, minHeight: 44, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14 },
});
