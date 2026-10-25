import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getProfile, updateProfile, type Profile } from '../../src/db/dao/profile';
import { listConditions, replaceConditions } from '../../src/db/dao/support';
import { syncSoon } from '../../src/notify/expoPort';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useApp } from '../../src/state/app';
import { ConditionPicker } from '../../src/support/ConditionPicker';
import { LEVEL_NAMES } from '../../src/support/copy';
import { suggestedLevel, type Condition } from '../../src/support/level';
import { Button } from '../../src/ui/Button';
import { SeverityPicker } from '../../src/ui/SeverityPicker';
import { AppText } from '../../src/ui/Text';

/** What I'm working through, and how much each affects me. Changes the suggested support level. */
export default function SupportEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [conditions, setConditions] = useState<Condition[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      setProfile(await getProfile(db));
      setConditions(await listConditions(db));
    })();
  }, [db]);

  const save = async () => {
    if (!conditions || !profile) return;
    await replaceConditions(db, conditions);
    if (!profile.supportLevelChosen) await updateProfile(db, { supportLevel: suggestedLevel(conditions) });
    syncSoon(db);
    useApp.getState().bumpData();
    router.back();
  };

  const level = conditions && profile ? (profile.supportLevelChosen ? profile.supportLevel : suggestedLevel(conditions)) : null;

  return (
    <StepLayout
      title="What I'm working through"
      subtitle="Private, on this phone only. It helps Steady know how closely to look out for you."
      footer={
        <>
          {level ? (
            <AppText variant="caption" tone="secondary" style={styles.center} accessibilityLiveRegion="polite">
              Support level: {LEVEL_NAMES[level]}
              {profile?.supportLevelChosen ? ' (you chose this)' : ' (set for you)'}
            </AppText>
          ) : null}
          <Button label="Save" onPress={save} />
        </>
      }
    >
      {conditions ? (
        <>
          {conditions.length ? (
            <View style={styles.chosen}>
              <AppText variant="label" tone="secondary" accessibilityRole="header">
                How much each affects you
              </AppText>
              {conditions.map((c) => (
                <SeverityPicker
                  key={c.name}
                  name={c.name}
                  value={c.severity}
                  onChange={(severity) => setConditions(conditions.map((x) => (x.name === c.name ? { ...x, severity } : x)))}
                />
              ))}
            </View>
          ) : null}
          <ConditionPicker conditions={conditions} onChange={setConditions} />
        </>
      ) : null}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  chosen: { gap: 14, marginBottom: 12 },
});
