import { StyleSheet, View } from 'react-native';

import { stepMinutes } from '../lib/time';
import { Button } from './Button';
import { TimeStepper } from './TimeStepper';

/** A sensible next time: 12 hours after a single time, otherwise 4 hours after the last. */
function nextTime(times: readonly number[]): number {
  const last = times[times.length - 1] ?? 480;
  return stepMinutes(last, times.length === 1 ? 720 : 240);
}

/** Times of day for one med, each with a stepper, plus "+ Add a time". At least one time stays. */
export function TimesEditor({ times, onChange }: { times: readonly number[]; onChange: (times: number[]) => void }) {
  return (
    <View>
      {times.map((t, idx) => (
        <TimeStepper
          key={idx}
          label={times.length > 1 ? `Time ${idx + 1}` : 'Time'}
          value={t}
          onChange={(v) => onChange(times.map((x, j) => (j === idx ? v : x)))}
          onRemove={times.length > 1 ? () => onChange(times.filter((_, j) => j !== idx)) : undefined}
        />
      ))}
      <Button variant="link" label="+ Add a time" onPress={() => onChange([...times, nextTime(times)])} style={styles.add} />
    </View>
  );
}

const styles = StyleSheet.create({
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
