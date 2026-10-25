import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { StillUp } from '../../src/db/schema';
import { formatHm } from '../../src/lib/time';
import { DEFAULT_SLEEP, type DraftSleep } from '../../src/onboarding/draft';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { STILL_UP_LABELS } from '../../src/support/copy';
import { LEVEL_RULES, stillUpFor, suggestedLevel } from '../../src/support/level';
import { Button } from '../../src/ui/Button';
import { Dropdown } from '../../src/ui/Dropdown';
import { AppText } from '../../src/ui/Text';
import { TimeStepper } from '../../src/ui/TimeStepper';
import { Toggle } from '../../src/ui/Toggle';

const STILL_UP: StillUp[] = ['off', 'once', 'every30', 'every15'];

export default function SleepStep() {
  const router = useRouter();
  const { sleep, conditions, chosenLevel } = useOnboarding((s) => s.draft);
  const patch = useOnboarding((s) => s.patch);
  // Turning reminders back on restores what was set before they were turned off.
  const last = useRef<DraftSleep>(sleep ?? DEFAULT_SLEEP);
  useEffect(() => {
    if (sleep) last.current = sleep;
  }, [sleep]);
  const level = chosenLevel ?? suggestedLevel(conditions);
  const set = (p: Partial<DraftSleep>) => sleep && patch({ sleep: { ...sleep, ...p } });

  return (
    <StepLayout
      step={8}
      title="Sleep"
      subtitle="Rest helps steady days. Steady can nudge you toward bed."
      footer={<Button label="Continue" onPress={() => router.push('/onboarding/guardian')} />}
    >
      <View>
        <Toggle label="Bedtime reminders" value={sleep !== null} onChange={(on) => patch({ sleep: on ? last.current : null })} />
        {sleep ? (
          <>
            <TimeStepper label="Bedtime" value={sleep.bedtimeMin} onChange={(v) => set({ bedtimeMin: v })} />
            <TimeStepper label="Wake up" value={sleep.wakeMin} onChange={(v) => set({ wakeMin: v })} />
            <Toggle label="Wind-down reminder" hint="30 minutes before bedtime" value={sleep.windDown} onChange={(v) => set({ windDown: v })} />
          </>
        ) : null}
      </View>
      {sleep ? (
        <>
          <Dropdown
            label="If you're still up"
            value={stillUpFor(level, sleep.stillUp)}
            options={STILL_UP.map((s) => ({ value: s, label: STILL_UP_LABELS[s] }))}
            onChange={(v) => set({ stillUp: v === LEVEL_RULES[level].stillUp ? null : v })}
          />
          <AppText variant="caption" tone="secondary">
            {sleep.stillUp === null ? 'Set by your support level. ' : ''}Tap Goodnight and Steady stays quiet until {formatHm(sleep.wakeMin)}.
          </AppText>
        </>
      ) : (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          No bedtime reminders. You can turn them on later in Settings.
        </AppText>
      )}
    </StepLayout>
  );
}
