import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { stepMinutes } from '../../src/lib/time';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';
import { TimeStepper } from '../../src/ui/TimeStepper';

/** Weeks start on Monday on screen; storage keeps 0 = Sunday. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL = [0, 1, 2, 3, 4, 5, 6];

/** Empty means every day. The last day can't be turned off. */
function toggleDay(days: number[], d: number): number[] {
  const current = days.length ? days : ALL;
  const next = current.includes(d) ? current.filter((x) => x !== d) : [...current, d].sort();
  if (next.length === 0) return days;
  return next.length === 7 ? [] : next;
}

function nextTime(times: number[]): number {
  const last = times[times.length - 1] ?? 480;
  return stepMinutes(last, times.length === 1 ? 720 : 240);
}

export default function ScheduleStep() {
  const router = useRouter();
  const theme = useTheme();
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
          {m.times.map((t, idx) => (
            <TimeStepper
              key={idx}
              label={m.times.length > 1 ? `Time ${idx + 1}` : 'Time'}
              value={t}
              onChange={(v) => updateMed(m.key, { times: m.times.map((x, j) => (j === idx ? v : x)) })}
              onRemove={m.times.length > 1 ? () => updateMed(m.key, { times: m.times.filter((_, j) => j !== idx) }) : undefined}
            />
          ))}
          <Button variant="link" label="+ Add a time" onPress={() => updateMed(m.key, { times: [...m.times, nextTime(m.times)] })} style={styles.add} />
          <View style={styles.days}>
            {WEEK.map((d) => {
              const on = m.days.length === 0 || m.days.includes(d);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="checkbox"
                  accessibilityLabel={NAME[d]}
                  accessibilityState={{ checked: on }}
                  onPress={() => updateMed(m.key, { days: toggleDay(m.days, d) })}
                  style={[
                    styles.day,
                    on
                      ? { backgroundColor: theme.accent, borderColor: theme.accentLine }
                      : { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border },
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
            {m.days.length === 0 ? 'Every day' : `${m.days.length} days a week`}
          </AppText>
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
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  days: { flexDirection: 'row', gap: 4, marginTop: 4 },
  day: { flex: 1, maxWidth: 48, height: 44, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14 },
});
