import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getProfile, updateProfile } from '../../src/db/dao/profile';
import { listConditions } from '../../src/db/dao/support';
import type { SupportLevel } from '../../src/db/schema';
import { syncSoon } from '../../src/notify/expoPort';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useApp } from '../../src/state/app';
import { levelReason } from '../../src/support/copy';
import { LevelPanel } from '../../src/support/LevelPanel';
import { suggestedLevel, type Condition } from '../../src/support/level';
import { Button } from '../../src/ui/Button';

/** Pick a support level, or go back to the one suggested from what I'm working through. */
export default function LevelEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [level, setLevel] = useState<SupportLevel | null>(null);

  useEffect(() => {
    (async () => {
      setConditions(await listConditions(db));
      setLevel((await getProfile(db))?.supportLevel ?? 'light');
    })();
  }, [db]);

  const suggested = suggestedLevel(conditions);

  const save = async () => {
    if (!level) return;
    await updateProfile(db, { supportLevel: level, supportLevelChosen: level !== suggested });
    syncSoon(db);
    useApp.getState().bumpData();
    router.back();
  };

  return (
    <StepLayout title="Support level" subtitle={levelReason(conditions)} footer={<Button label="Save" onPress={save} />}>
      {level ? <LevelPanel level={level} suggested={suggested} onChange={setLevel} /> : null}
    </StepLayout>
  );
}
