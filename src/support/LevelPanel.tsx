import { StyleSheet, View } from 'react-native';

import type { SupportLevel } from '../db/schema';
import { HAIRLINE, TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { AppText } from '../ui/Text';
import { describeLevel, LEVEL_NAMES } from './copy';

const ORDER: SupportLevel[] = ['light', 'steady', 'close'];

/** The level, a small meter, what it changes, and a switch to pick another. */
export function LevelPanel({ level, suggested, onChange }: { level: SupportLevel; suggested: SupportLevel; onChange: (level: SupportLevel) => void }) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.levelRow}>
        <AppText variant="title">{LEVEL_NAMES[level]}</AppText>
        <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[12, 17, 22].map((h, i) => (
            <View key={h} style={[styles.bar, { height: h, backgroundColor: i <= ORDER.indexOf(level) ? theme.accentLine : TRACK }]} />
          ))}
        </View>
        <AppText variant="caption" tone="secondary" style={styles.auto}>
          {level === suggested ? 'set for you' : 'you chose this'}
        </AppText>
      </View>
      <View>
        {describeLevel(level).map((r, i, all) => (
          <View key={r.icon} style={[styles.rule, i === all.length - 1 && styles.last]}>
            <Icon name={r.icon} size={20} />
            <AppText style={styles.grow}>{r.text}</AppText>
          </View>
        ))}
      </View>
      <Segmented label="Support level" options={ORDER.map((l) => ({ value: l, label: LEVEL_NAMES[l] }))} value={level} onChange={onChange} />
      <AppText variant="caption" tone="secondary">
        Not medical advice. Your care team knows you best.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { width: 8, borderRadius: 3 },
  auto: { marginLeft: 'auto' },
  rule: { flexDirection: 'row', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  last: { borderBottomWidth: 0 },
  grow: { flex: 1 },
});
