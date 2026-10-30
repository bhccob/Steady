import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getProfile, updateProfile, type Profile } from '../../src/db/dao/profile';
import { syncSoon } from '../../src/notify/port';
import type { DraftSleep } from '../../src/onboarding/draft';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { SleepForm } from '../../src/support/SleepForm';
import { Button } from '../../src/ui/Button';

/** Bedtime reminders, from Settings. */
export default function SleepEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sleep, setSleep] = useState<DraftSleep | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getProfile(db);
      setProfile(p);
      if (p?.bedtimeMin != null && p.wakeMin != null) setSleep({ bedtimeMin: p.bedtimeMin, wakeMin: p.wakeMin, windDown: p.windDown, stillUp: p.stillUp });
    })();
  }, [db]);

  const save = async () => {
    await updateProfile(
      db,
      sleep ? { bedtimeMin: sleep.bedtimeMin, wakeMin: sleep.wakeMin, windDown: sleep.windDown, stillUp: sleep.stillUp } : { bedtimeMin: null, wakeMin: null },
    );
    syncSoon(db);
    router.back();
  };

  return (
    <StepLayout title="Sleep" subtitle="Rest helps steady days. Steady can nudge you toward bed." footer={<Button label="Save" onPress={save} />}>
      {profile ? <SleepForm sleep={sleep} level={profile.supportLevel} onChange={setSleep} /> : null}
    </StepLayout>
  );
}
