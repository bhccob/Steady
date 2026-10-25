import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logEvent } from '../src/db/dao/events';
import { lightHaptic } from '../src/lib/haptics';
import { useReducedMotion } from '../src/lib/useReducedMotion';
import { breathAt, BREATH_TOTAL_MS, type BreathPhase } from '../src/patterns/breath';
import { layout } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';
import { Background } from '../src/ui/Background';
import { Button } from '../src/ui/Button';
import { Icon } from '../src/ui/Icon';
import { AppText } from '../src/ui/Text';

const WORDS: Record<BreathPhase, string> = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', done: "That's a minute." };
const PHASE_MS: Record<Exclude<BreathPhase, 'done'>, number> = { in: 4_000, hold: 7_000, out: 8_000 };
const SMALL = 0.55;
const TICK_MS = 200;
const RETURN_AFTER_MS = 2_500;

/** A minute of 4-7-8 breathing (spec §6.4). No streaks, no score, nothing to get right. */
export default function Breathe() {
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [scale] = useState(() => new Animated.Value(SMALL));
  const lastPhase = useRef<BreathPhase | null>(null);
  const now = breathAt(elapsed);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.min(BREATH_TOTAL_MS, Date.now() - started)), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // At each change: a soft pulse, and the circle eases to its next size over the whole phase.
  useEffect(() => {
    if (now.phase === lastPhase.current) return;
    lastPhase.current = now.phase;
    if (now.phase === 'done') {
      logEvent(db, 'grounding_done', { at: new Date().toISOString() }).catch(() => {});
      const back = setTimeout(() => router.back(), RETURN_AFTER_MS);
      return () => clearTimeout(back);
    }
    lightHaptic();
    if (reduced) return;
    const target = now.phase === 'out' ? SMALL : 1;
    Animated.timing(scale, { toValue: target, duration: PHASE_MS[now.phase], useNativeDriver: true }).start();
  }, [now.phase, db, reduced, router, scale]);

  return (
    <Background>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Stop and go back" onPress={() => router.back()} style={styles.close}>
          <Icon name="x" size={24} />
        </Pressable>
      </View>
      <View style={styles.center}>
        <AppText variant="caption" tone="secondary">
          A minute to breathe
        </AppText>
        <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.circle, { backgroundColor: theme.accent, borderColor: theme.accentLine, transform: [{ scale: reduced ? 0.8 : scale }] }]} />
        </View>
        <AppText variant="title" accessibilityLiveRegion="polite" accessibilityRole="header">
          {WORDS[now.phase]}
        </AppText>
        <AppText tone="secondary">{now.phase === 'done' ? 'Take your time.' : `${now.secondsLeft}`}</AppText>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {now.phase === 'done' ? <Button label="Back" onPress={() => router.back()} /> : null}
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: layout.gutter, flexDirection: 'row' },
  close: { width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: layout.gutter },
  stage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  circle: { width: 220, height: 220, borderRadius: 999, borderWidth: 2, opacity: 0.9 },
  bottom: { paddingHorizontal: layout.gutter, minHeight: 72, justifyContent: 'flex-end' },
});
