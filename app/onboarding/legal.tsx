import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform } from 'react-native';

import { deviceTimeZone } from '../../src/lib/deviceTz';
import { completeOnboarding } from '../../src/onboarding/complete';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { useApp } from '../../src/state/app';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

export default function LegalStep() {
  const router = useRouter();
  const db = useSQLiteContext();
  const draft = useOnboarding((s) => s.draft);
  const reset = useOnboarding((s) => s.reset);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finish = async () => {
    if (saving) return;
    if (!draft.ageConfirmed) {
      router.push('/onboarding/age');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await completeOnboarding(db, draft, { timezone: deviceTimeZone(), now: new Date().toISOString() });
      reset();
      // Signed in before setup? Its first backup goes now; without an account this does nothing.
      useApp.getState().backupNow();
      router.replace('/home');
    } catch {
      setError("That didn't save. Try once more.");
      setSaving(false);
    }
  };

  return (
    <StepLayout step={11} title="Before we start" footer={<Button label={saving ? 'Saving…' : 'I understand'} onPress={finish} />}>
      <AppText>{"Steady helps you keep track. It isn't medical advice, and it doesn't replace care from your doctor or pharmacist."}</AppText>
      <AppText>Change or stop a medication only with them.</AppText>
      <AppText>If things feel like too much, a free crisis line is always two taps from Home.</AppText>
      <AppText variant="caption" tone="secondary">
        {Platform.OS === 'web'
          ? 'Everything else stays on this phone. You can export it or delete it any time in Settings.'
          : 'Everything stays on this phone. You can export it or delete it any time in Settings.'}
      </AppText>
      {error ? (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </StepLayout>
  );
}
