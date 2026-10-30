import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../theme/tokens';
import { Background } from '../ui/Background';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/Text';
import type { Install } from './useInstall';

function Step({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.step}>
      <Icon name={icon} size={22} />
      <AppText style={styles.grow}>{children}</AppText>
    </View>
  );
}

/**
 * Web only: asks to be added to the Home Screen before setup, so marks and reminders stay put.
 * Shown by the root layout before the database opens, so this tab never holds it: the installed
 * app, opening in its own window, gets it instead.
 */
export function InstallScreen({ step, prompt, continueInBrowser }: Install) {
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 };

  if (step === 'open-installed') {
    return (
      <Background>
        <View style={[styles.column, padding]}>
          <AppText variant="display" accessibilityRole="header">
            Steady is installed.
          </AppText>
          <AppText tone="secondary" style={styles.sub}>
            Open it from your Home Screen. You can close this tab.
          </AppText>
        </View>
      </Background>
    );
  }

  return (
    <Background>
      <View style={[styles.column, padding]}>
        <AppText variant="display" accessibilityRole="header">
          {'Add Steady to\nyour Home Screen.'}
        </AppText>
        <AppText tone="secondary" style={styles.sub}>
          Your marks stay put, and reminders can reach you, once Steady is installed.
        </AppText>

        <View style={styles.steps}>
          {step === 'ios-steps' ? (
            <>
              <Step icon="share">Tap Share in Safari&apos;s toolbar.</Step>
              <Step icon="plus-square">Choose Add to Home Screen, then open Steady from there.</Step>
            </>
          ) : step === 'browser-steps' ? (
            <Step icon="more-vertical">Open your browser&apos;s menu and choose Install app, or Add to Home Screen.</Step>
          ) : null}
        </View>

        <View style={styles.footer}>
          {step === 'install-button' ? <Button label="Install Steady" onPress={prompt} /> : null}
          <Button variant="link" label="Continue in the browser" accessibilityHint="Reminders stay off, and your marks may not last" onPress={continueInBrowser} />
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter },
  sub: { marginTop: 8 },
  steps: { marginTop: 32, gap: 18 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grow: { flex: 1 },
  footer: { marginTop: 'auto', gap: 10 },
});
