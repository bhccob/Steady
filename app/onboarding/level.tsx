import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { SupportLevel } from '../../src/db/schema';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { describeLevel, LEVEL_NAMES, levelReason } from '../../src/support/copy';
import { suggestedLevel } from '../../src/support/level';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { Segmented } from '../../src/ui/Segmented';
import { AppText } from '../../src/ui/Text';

const ORDER: SupportLevel[] = ['light', 'steady', 'close'];

export default function LevelStep() {
  const router = useRouter();
  const theme = useTheme();
  const { conditions, chosenLevel } = useOnboarding((s) => s.draft);
  const patch = useOnboarding((s) => s.patch);
  const suggested = suggestedLevel(conditions);
  const level = chosenLevel ?? suggested;
  const next = () => router.push('/onboarding/sleep');

  return (
    <StepLayout step={7} title="Your support level" subtitle={levelReason(conditions)} footer={<Button label="Continue" onPress={next} />}>
      <View style={styles.levelRow}>
        <AppText variant="title">{LEVEL_NAMES[level]}</AppText>
        <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[12, 17, 22].map((h, i) => (
            <View key={h} style={[styles.bar, { height: h, backgroundColor: i <= ORDER.indexOf(level) ? theme.accentLine : 'rgba(27, 22, 19, 0.14)' }]} />
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
      <Segmented
        label="Support level"
        options={ORDER.map((l) => ({ value: l, label: LEVEL_NAMES[l] }))}
        value={level}
        onChange={(v) => patch({ chosenLevel: v === suggested ? null : v })}
      />
      <AppText variant="caption" tone="secondary">
        Not medical advice. Your care team knows you best.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { width: 8, borderRadius: 3 },
  auto: { marginLeft: 'auto' },
  rule: { flexDirection: 'row', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(27, 22, 19, 0.08)' },
  last: { borderBottomWidth: 0 },
  grow: { flex: 1 },
});
