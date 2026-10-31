import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { AccountError, createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL, PRIVACY_URL } from '../../src/account/config';
import { looksLikeEmail } from '../../src/account/input';
import { openUrl } from '../../src/lib/contact';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { Button } from '../../src/ui/Button';
import { CheckRow } from '../../src/ui/CheckRow';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/** Step one of signing in: the email address, and a clear yes to keeping a backup. */
export default function AccountEmail() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (sending) return;
    if (!looksLikeEmail(email)) {
      setError("That email doesn't look right. Check it and try again.");
      return;
    }
    if (!consent) {
      setError('Tick the box first, so Steady can keep your backup.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await createAccountApi(ACCOUNT_URL).requestCode(email.trim());
      router.push({ pathname: '/account/code', params: { email: email.trim(), from: from ?? 'welcome' } });
    } catch (e) {
      setError(e instanceof AccountError && e.status === 429 ? 'A code was sent a moment ago. Wait a little, then try again.' : "That didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <StepLayout
      title="What's your email?"
      subtitle="We'll send you a 6-digit code. No password to remember."
      footer={<Button label={sending ? 'Sending…' : 'Send my code'} onPress={send} />}
    >
      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        onSubmitEditing={send}
      />
      <CheckRow label="Back up my pills, marks, moods, answers and the people I add to Steady's server." checked={consent} onToggle={() => setConsent(!consent)} />
      <AppText variant="caption" tone="secondary">
        Your email is only used to sign you in. Never shared, never marketing.
      </AppText>
      <Button variant="link" label="How Steady keeps it private" onPress={() => openUrl(Platform.OS === 'web' ? '/privacy.html' : PRIVACY_URL)} style={styles.link} />
      {error ? (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
