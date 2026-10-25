import { authenticateAsync } from 'expo-local-authentication';
import { allowScreenCaptureAsync, disableAppSwitcherProtectionAsync, enableAppSwitcherProtectionAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View } from 'react-native';

import { getProfile } from '../db/dao/profile';
import { useApp } from '../state/app';
import { layout } from '../theme/tokens';
import { Background } from '../ui/Background';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import { shouldLock } from './lock';

const CAPTURE_KEY = 'steady-privacy';

/**
 * The face or fingerprint lock (spec §8.5) and hiding Steady in the app switcher. Renders the
 * lock screen over everything when needed; otherwise nothing.
 */
export function PrivacyGate() {
  const db = useSQLiteContext();
  const privacy = useApp((s) => s.privacy);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const result = await authenticateAsync({ promptMessage: 'Unlock Steady' });
      if (result.success) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  // Load the saved settings once; Settings updates them in app state afterwards.
  useEffect(() => {
    getProfile(db).then((p) => {
      if (!p) return;
      useApp.getState().setPrivacy({ lock: p.biometricLock, hide: p.hideInSwitcher });
      if (shouldLock({ enabled: p.biometricLock, launching: true, backgroundedAt: null, now: Date.now() })) setLocked(true);
    });
  }, [db]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s !== 'active') return;
      if (shouldLock({ enabled: useApp.getState().privacy.lock, launching: false, backgroundedAt: backgroundedAt.current, now: Date.now() })) setLocked(true);
      backgroundedAt.current = null;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  // iOS blurs the app-switcher preview; Android can only mark the window secure, which also blocks screenshots.
  useEffect(() => {
    const on = privacy.hide;
    const apply = Platform.OS === 'ios' ? (on ? enableAppSwitcherProtectionAsync(0.9) : disableAppSwitcherProtectionAsync()) : on ? preventScreenCaptureAsync(CAPTURE_KEY) : allowScreenCaptureAsync(CAPTURE_KEY);
    apply.catch(() => {});
  }, [privacy.hide]);

  return (
    <Modal visible={locked} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <Background>
        <View style={styles.center} accessibilityViewIsModal>
          <Icon name="lock" size={34} />
          <AppText variant="title" accessibilityRole="header" style={styles.text}>
            Steady is locked
          </AppText>
          <AppText tone="secondary" style={styles.text}>
            Unlock with your face, fingerprint or phone passcode.
          </AppText>
          <Button label="Unlock" onPress={unlock} style={styles.button} />
        </View>
      </Background>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: layout.gutter },
  text: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 16 },
});
