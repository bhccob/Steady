import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { forgetAccountHere, restoreChoices, restoreFromBackup, type RestoreStep } from '../../src/account/flow';
import { clearSession, loadSession } from '../../src/account/session';
import { requestPermissionsAsync } from '../../src/lib/notifications';
import { syncSoon, turnOnReminders } from '../../src/notify/port';
import { NewerBackupError } from '../../src/settings/data';
import { useApp } from '../../src/state/app';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

type Step = { kind: RestoreStep; name?: string; problem?: string };

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

const TITLE: Record<RestoreStep, string> = {
  working: 'Welcome back.',
  done: 'Welcome back.',
  newer: 'Welcome back.',
  problem: "Couldn't open your backup.",
};

const BODY: Record<RestoreStep, string> = {
  working: 'Getting your pills, marks and settings…',
  done: 'Your pills, marks and settings are back. Turn on reminders so they keep coming on this device.',
  newer: 'This backup is from a newer Steady. Update Steady, then sign in again, or set up without it for now.',
  problem: "Your backup is safe on Steady's server. Try again, or set up without it for now and sign in later from Settings.",
};

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

  // Signed out here first, so this fresh start can never be offered as a replacement for the backup.
  const setUpWithout = async () => {
    await forgetAccountHere(clearSession);
    router.replace('/onboarding/name');
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

  const choices = restoreChoices(step.kind);

  return (
    <Background>
      <View style={[styles.column, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }]}>
        <AppText variant="title" accessibilityRole="header">
          {step.kind === 'done' && step.name ? `Welcome back, ${step.name}.` : TITLE[step.kind]}
        </AppText>
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          {BODY[step.kind]}
        </AppText>
        {step.kind === 'problem' && step.problem ? (
          <AppText variant="caption" tone="secondary" selectable>
            {step.problem}
          </AppText>
        ) : null}
        <View style={styles.footer}>
          {choices.includes('reminders') ? <Button label="Turn on reminders" onPress={remindersThenHome} /> : null}
          {choices.includes('not-now') ? <Button variant="link" label="Not now" onPress={() => router.replace('/home')} style={styles.center} /> : null}
          {choices.includes('retry') ? <Button label="Try again" onPress={retry} /> : null}
          {choices.includes('set-up-without') ? (
            <Button variant={choices.includes('retry') ? 'link' : 'primary'} label="Set up without my backup" onPress={setUpWithout} style={choices.includes('retry') ? styles.center : undefined} />
          ) : null}
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, gap: 10 },
  footer: { marginTop: 'auto', gap: 8 },
  center: { alignSelf: 'center' },
});
