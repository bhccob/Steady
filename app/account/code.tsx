import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AccountError, createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { hasLocalData } from '../../src/account/flow';
import { digitsFromPaste } from '../../src/account/input';
import { afterSignIn } from '../../src/account/next';
import { deviceId, saveSession } from '../../src/account/session';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useApp } from '../../src/state/app';
import { MAX_FONT_SCALE, radius } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

const RESEND_AFTER_S = 30;

/** Step two: the 6-digit code from the email. Pasting fills every box, and it moves on by itself. */
export default function AccountCode() {
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { email = '', from = 'welcome' } = useLocalSearchParams<{ email?: string; from?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (digits: string) => {
    setBusy(true);
    setError('');
    try {
      const api = createAccountApi(ACCOUNT_URL);
      const result = await api.signIn(email, digits, await deviceId());
      const signedInAs = email.trim().toLowerCase();
      await saveSession({ token: result.token, email: signedInAs, savedAt: result.savedAt });
      useApp.getState().setAccount({ email: signedInAs, savedAt: result.savedAt, state: 'ok' });
      const next = afterSignIn(result, await hasLocalData(db));
      if (next === 'setup') router.replace('/onboarding/name');
      else if (next === 'restore') router.replace('/account/restore');
      else if (next === 'choose') router.replace('/account/choose');
      else {
        await api.claim(result.token);
        await useApp.getState().backupNow();
        router.dismissTo(from === 'settings' ? '/settings' : '/home');
      }
    } catch (e) {
      setCode('');
      if (e instanceof AccountError && e.reason === 'code-expired') setError('That code has run out. Send a new one.');
      else if (e instanceof AccountError && e.status === 401) setError("That code didn't work. Try again, or send a new one.");
      else setError("That didn't go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const digits = digitsFromPaste(text);
    setCode(digits);
    if (digits.length === 6 && !busy) submit(digits);
  };

  const resend = async () => {
    setError('');
    try {
      await createAccountApi(ACCOUNT_URL).requestCode(email);
      setWait(RESEND_AFTER_S);
      setResent(true);
    } catch {
      setError("A new code didn't send. Wait a little, then try again.");
    }
  };

  return (
    <StepLayout title="Check your email" subtitle={`We sent a code to ${email}. It works for 10 minutes.`}>
      <View style={styles.boxes}>
        {Array.from({ length: 6 }, (_, i) => {
          const current = i === Math.min(code.length, 5) && !busy;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { backgroundColor: theme.glass.overlay, borderColor: current ? theme.accentLine : theme.glass.border, borderWidth: current ? 2 : 1 },
              ]}
            >
              <AppText variant="heading" maxFontSizeMultiplier={1.4}>
                {code[i] ?? ''}
              </AppText>
            </View>
          );
        })}
        {/* One real input over the boxes: typing, pasting and the phone's code suggestion all land here. */}
        <TextInput
          value={code}
          onChangeText={onChange}
          editable={!busy}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={14}
          caretHidden
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="6-digit code"
          accessibilityHint="The code from the email Steady sent you"
          style={styles.input}
        />
      </View>
      {busy ? (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          Checking…
        </AppText>
      ) : null}
      {error ? (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <Button
        variant="link"
        label={wait > 0 ? `Send a new code in ${wait} s` : resent ? 'Send another code' : 'Send a new code'}
        onPress={() => wait <= 0 && resend()}
        style={styles.link}
      />
      <Button variant="link" label="Use a different email" onPress={() => router.back()} style={styles.link} />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8, marginTop: 8 },
  box: { flex: 1, height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  input: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.011, color: 'transparent' },
  link: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
