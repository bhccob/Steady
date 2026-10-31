import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { loadSession } from '../../src/account/session';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useApp } from '../../src/state/app';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

/** Signed in on a device that already has data, to an account that already has a backup: keep which? */
export default function AccountChoose() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const keepThisPhone = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await loadSession();
      if (!session) throw new Error('Not signed in');
      await createAccountApi(ACCOUNT_URL).claim(session.token);
      await useApp.getState().backupNow();
      router.dismissTo('/settings');
    } catch {
      setError("That didn't go through. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <StepLayout title="Which one to keep?" subtitle="This account already has a backup, and this device has its own pills and marks.">
      <View style={styles.choices}>
        <Button label="Use your backup" onPress={() => router.replace('/account/restore')} />
        <AppText variant="caption" tone="secondary">
          {"Replaces what's on this device with your backup."}
        </AppText>
        <Button variant="secondary" label={busy ? 'Saving…' : "Keep this phone's data"} onPress={keepThisPhone} />
        <AppText variant="caption" tone="secondary">
          {"Keeps this device's data and makes it your new backup."}
        </AppText>
        {error ? (
          <AppText tone="secondary" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8, marginTop: 8 },
});
