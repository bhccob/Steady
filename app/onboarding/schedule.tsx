import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { DayPicker } from '../../src/ui/DayPicker';
import { AppText } from '../../src/ui/Text';
import { TimesEditor } from '../../src/ui/TimesEditor';

export default function ScheduleStep() {
  const router = useRouter();
  const meds = useOnboarding((s) => s.draft.meds);
  const updateMed = useOnboarding((s) => s.updateMed);
  const next = () => router.push('/onboarding/support');

  return (
    <StepLayout step={4} title="When do you take it?" subtitle="Add each time of day." footer={<Button label="Continue" onPress={next} />}>
      {meds.map((m, i) => (
        <View key={m.key} style={[styles.med, i > 0 && styles.divider]}>
          <View style={styles.head}>
            <View style={[styles.swatch, m.color.startsWith('linear') ? { backgroundImage: m.color } : { backgroundColor: m.color }]} />
            <AppText variant="heading">{m.label.trim() || 'my pill'}</AppText>
          </View>
          <TimesEditor times={m.times} onChange={(times) => updateMed(m.key, { times })} />
          <DayPicker days={m.days} onChange={(days) => updateMed(m.key, { days })} />
        </View>
      ))}
      <AppText variant="caption" tone="secondary">
        Each reminder comes at the time you set. Follow-ups stay quiet from 22:00 to 07:00. You can change that in Settings.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  med: { gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(27, 22, 19, 0.08)', paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 20, height: 20, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(27, 22, 19, 0.22)' },
});
