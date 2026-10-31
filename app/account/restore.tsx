import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { restoreFromBackup } from '../../src/account/flow';
import { loadSession } from '../../src/account/session';
import { requestPermissionsAsync } from '../../src/lib/notifications';
import { syncSoon, turnOnReminders } from '../../src/notify/port';
import { NewerBackupError } from '../../src/settings/data';
import { useApp } from '../../src/state/app';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { Button } from '../../src/ui/Button';
import { LoadProblem } from '../../src/ui/LoadProblem';
import { AppText } from '../../src/ui/Text';

type Step = { kind: 'working' } | { kind: 'done'; name: string } | { kind: 'newer' } | { kind: 'problem'; problem: string };

async function restore(db: Parameters<typeof restoreFromBackup>[0]['db']): Promise<Step> {
  try {
    const session = await loadSession();
    if (!session) return { kind: 'problem', problem: 'Not signed in.' };
    const { name } = await restoreFromBackup({ db, api: createAccountApi(ACCOUNT_URL), token: session.token });
    syncSoon(db);
    useApp.getState().bumpData();
    return { kind: 'done', name };
  } catch (e) {
    if (e instanceof NewerBackupError) return { kind: 'newer' };
    return { kind: 'problem', problem: e instanceof Error ? e.message : String(e) };
  }
}

/** Brings the backup onto this device, then asks for reminders, which setup would have asked for. */
export default function AccountRestore() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: 'working' });

  useEffect(() => {
    let live = true;
    restore(db).then((s) => live && setStep(s));
    return () => {
      live = false;
    };
  }, [db]);

  const retry = () => {
    setStep({ kind: 'working' });
    restore(db).then(setStep);
  };

  const remindersThenHome = async () => {
    try {
      if (Platform.OS === 'web') await turnOnReminders();
      else await requestPermissionsAsync();
    } finally {
      syncSoon(db);
      router.replace('/home');
    }
  };

  if (step.kind === 'problem') return <LoadProblem what="your backup" problem={step.problem} onRetry={retry} />;

  return (
    <Background>
      <View style={[styles.column, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }]}>
        <AppText variant="title" accessibilityRole="header">
          {step.kind === 'done' && step.name ? `Welcome back, ${step.name}.` : 'Welcome back.'}
        </AppText>
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          {step.kind === 'working'
            ? 'Getting your pills, marks and settings…'
            : step.kind === 'newer'
              ? 'This backup is from a newer Steady. Update Steady, then sign in again.'
              : 'Your pills, marks and settings are back. Turn on reminders so they keep coming on this device.'}
        </AppText>
        {step.kind === 'done' ? (
          <View style={styles.footer}>
            <Button label="Turn on reminders" onPress={remindersThenHome} />
            <Button variant="link" label="Not now" onPress={() => router.replace('/home')} style={styles.center} />
          </View>
        ) : null}
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, gap: 10 },
  footer: { marginTop: 'auto', gap: 8 },
  center: { alignSelf: 'center' },
});
