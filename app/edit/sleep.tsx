import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getProfile, noteSetupAnswered, updateProfile, type Profile } from '../../src/db/dao/profile';
import { syncSoon } from '../../src/notify/port';
import { sleepToEdit, type DraftSleep } from '../../src/onboarding/draft';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { SleepForm } from '../../src/support/SleepForm';
import { Button } from '../../src/ui/Button';

/** Bedtime reminders, from Settings or Home's setup list (which passes ?suggest=1). */
export default function SleepEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { suggest } = useLocalSearchParams<{ suggest?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sleep, setSleep] = useState<DraftSleep | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getProfile(db);
      setProfile(p);
      if (p) setSleep(sleepToEdit(p, suggest === '1'));
    })();
  }, [db, suggest]);

  const save = async () => {
    await updateProfile(
      db,
      sleep ? { bedtimeMin: sleep.bedtimeMin, wakeMin: sleep.wakeMin, windDown: sleep.windDown, stillUp: sleep.stillUp } : { bedtimeMin: null, wakeMin: null },
    );
    // Bedtime reminders left off still answers Home's setup step.
    await noteSetupAnswered(db, 'sleep');
    syncSoon(db);
    router.back();
  };

  return (
    <StepLayout title="Sleep" subtitle="Rest helps steady days. Steady can nudge you toward bed." footer={<Button label="Save" onPress={save} />}>
      {profile ? <SleepForm sleep={sleep} level={profile.supportLevel} onChange={setSleep} /> : null}
    </StepLayout>
  );
}
