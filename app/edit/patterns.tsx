import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listHarderTimes, MAX_HARDER_TIMES, replaceHarderTimes } from '../../src/db/dao/harderTimes';
import { StepLayout } from '../../src/onboarding/StepLayout';
import type { HarderTime } from '../../src/patterns/windows';
import { useApp } from '../../src/state/app';
import { HAIRLINE } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { DayPicker } from '../../src/ui/DayPicker';
import { AppText } from '../../src/ui/Text';
import { TimeStepper } from '../../src/ui/TimeStepper';

const NEW_TIME: HarderTime = { days: [], startMin: 20 * 60, endMin: 22 * 60 };

/** "My harder times" (spec §6.2a): up to three, each on some days, in half hours. */
export default function PatternsEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [times, setTimes] = useState<HarderTime[] | null>(null);
  const [hint, setHint] = useState('');

  useEffect(() => {
    listHarderTimes(db).then(setTimes);
  }, [db]);

  const set = (i: number, p: Partial<HarderTime>) => {
    setHint('');
    setTimes((all) => all && all.map((t, j) => (j === i ? { ...t, ...p } : t)));
  };

  const save = async () => {
    if (!times) return;
    if (times.some((t) => t.endMin <= t.startMin)) {
      setHint('Each "Until" needs to be after its "From".');
      return;
    }
    await replaceHarderTimes(db, times);
    useApp.getState().bumpData();
    router.back();
  };

  return (
    <StepLayout
      title="My harder times"
      subtitle="Times that tend to be hard for you. If a dose is still open then, Steady shows a gentle card in the app. Never a notification."
      footer={
        <>
          {hint ? (
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.center}>
              {hint}
            </AppText>
          ) : null}
          <Button label="Save" onPress={save} />
        </>
      }
    >
      {times?.map((t, i) => (
        <View key={i} style={[styles.time, i > 0 && styles.divider]}>
          <View style={styles.head}>
            <AppText variant="label" tone="secondary" accessibilityRole="header">
              Harder time {i + 1}
            </AppText>
            <Button variant="link" label="Remove" accessibilityLabel={`Remove harder time ${i + 1}`} onPress={() => setTimes(times.filter((_, j) => j !== i))} style={styles.link} />
          </View>
          <DayPicker days={t.days} onChange={(days) => set(i, { days })} />
          <TimeStepper label="From" value={t.startMin} step={30} onChange={(v) => set(i, { startMin: v })} />
          <TimeStepper label="Until" value={t.endMin} step={30} onChange={(v) => set(i, { endMin: v })} />
        </View>
      ))}
      {times && times.length < MAX_HARDER_TIMES ? (
        <Button variant="link" label="+ Add a harder time" onPress={() => setTimes([...times, NEW_TIME])} style={styles.link} />
      ) : null}
      <AppText variant="caption" tone="secondary">
        Steady also notices on its own: a time of day with several rough moods, and, after two weeks, days of the week that often run late. These are your own patterns,
        shown only to you.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  time: { gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  center: { textAlign: 'center' },
});
