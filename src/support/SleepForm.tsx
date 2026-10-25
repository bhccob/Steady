import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { StillUp, SupportLevel } from '../db/schema';
import { formatHm } from '../lib/time';
import { DEFAULT_SLEEP, type DraftSleep } from '../onboarding/draft';
import { Dropdown } from '../ui/Dropdown';
import { AppText } from '../ui/Text';
import { TimeStepper } from '../ui/TimeStepper';
import { Toggle } from '../ui/Toggle';
import { STILL_UP_LABELS } from './copy';
import { LEVEL_RULES, stillUpFor } from './level';

const STILL_UP: StillUp[] = ['off', 'once', 'every30', 'every15'];

/** Bedtime reminders: a switch, then bedtime, wake time, wind-down and "if you're still up". Null means off. */
export function SleepForm({ sleep, level, onChange }: { sleep: DraftSleep | null; level: SupportLevel; onChange: (sleep: DraftSleep | null) => void }) {
  // Turning reminders back on restores what was set before they were turned off.
  const last = useRef<DraftSleep>(sleep ?? DEFAULT_SLEEP);
  useEffect(() => {
    if (sleep) last.current = sleep;
  }, [sleep]);
  const set = (p: Partial<DraftSleep>) => sleep && onChange({ ...sleep, ...p });

  return (
    <>
      <View>
        <Toggle label="Bedtime reminders" value={sleep !== null} onChange={(on) => onChange(on ? last.current : null)} />
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
    </>
  );
}
