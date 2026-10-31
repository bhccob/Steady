import { useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { forgetAccountHere } from '../../src/account/flow';
import { clearSession } from '../../src/account/session';
import { WelcomePath } from '../../src/onboarding/WelcomePath';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { AppText } from '../../src/ui/Text';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A sign-in left over from a restore that didn't finish must not follow a fresh start.
  const startWithout = async () => {
    await forgetAccountHere(clearSession);
    router.push('/onboarding/name');
  };

  return (
    <Background>
      <View style={[styles.column, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <WelcomePath />
        <AppText variant="display" accessibilityRole="header">
          {'Small marks,\nsteadier days.'}
        </AppText>
        <AppText tone="secondary" style={styles.sub}>
          A gentle way to keep track of your pills, at your own pace. One block for every day you mark.
        </AppText>
        <View style={styles.footer}>
          <Button
            label="Continue with email"
            icon={<Icon name="mail" size={18} />}
            onPress={() => router.push({ pathname: '/account/email', params: { from: 'welcome' } })}
          />
          <AppText variant="caption" tone="secondary" style={styles.center}>
            With an account, Steady keeps a private backup so you can pick up on a new phone.
          </AppText>
          <Button variant="link" label="Start without an account" onPress={startWithout} style={styles.start} />
          <AppText variant="caption" tone="secondary" style={styles.center}>
            {Platform.OS === 'web' ? 'No account. No email. Only your reminder times leave this phone.' : 'No account. No email. It all stays on this phone.'}
          </AppText>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter },
  sub: { marginTop: 8 },
  footer: { marginTop: 'auto', gap: 10 },
  center: { textAlign: 'center' },
  start: { alignSelf: 'center' },
});
