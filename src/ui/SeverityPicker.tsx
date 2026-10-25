import { Pressable, StyleSheet, View } from 'react-native';

import type { Severity } from '../db/schema';
import { SEVERITY_LABELS } from '../support/level';
import { TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

const STOPS: Severity[] = [0, 1, 2];

/** Mild, moderate or severe on a three-stop track. */
export function SeverityPicker({ name, value, onChange }: { name: string; value: Severity; onChange: (v: Severity) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={`How much ${name} affects you`}>
      <View style={styles.head}>
        <AppText variant="bodyStrong" style={styles.name}>
          {name}
        </AppText>
        <AppText tone="secondary">{SEVERITY_LABELS[value]}</AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.line, { backgroundColor: TRACK }]} />
        <View style={[styles.line, { backgroundColor: theme.accentLine, right: `${100 - value * 50}%` }]} />
        {STOPS.map((s) => {
          const on = s === value;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityLabel={SEVERITY_LABELS[s]}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(s)}
              style={[styles.stop, { left: `${s * 50}%` }]}
            >
              <View
                style={[
                  on ? styles.dotOn : styles.dot,
                  on
                    ? { backgroundColor: theme.accent, borderColor: theme.accentLine, borderBottomColor: theme.accentDeep }
                    : s < value
                      ? { backgroundColor: theme.accentLine, borderColor: theme.accentLine }
                      : { backgroundColor: theme.background[0], borderColor: theme.text.secondary },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {STOPS.map((s) => (
          <AppText key={s} variant="caption" tone="secondary">
            {SEVERITY_LABELS[s]}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 17 },
  track: { height: 44, marginHorizontal: 13 },
  line: { position: 'absolute', left: 0, right: 0, top: 21, height: 3, borderRadius: 99 },
  stop: { position: 'absolute', top: 0, width: 44, height: 44, marginLeft: -22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 999, borderWidth: 2 },
  dotOn: { width: 26, height: 26, borderRadius: 999, borderWidth: 2, borderBottomWidth: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
