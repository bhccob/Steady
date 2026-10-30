import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { useApp } from '../state/app';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Glass } from '../ui/Glass';
import { AppText } from '../ui/Text';
import { glowColour } from './note';
import { PillPicture } from './PillPicture';

/** A note older than this is out of date ("today at 19:00" may have passed), so Home skips it. */
const FRESH_MS = 10 * 60_000;
/** How long the note stays once Home is showing it. */
const SHOWN_MS = 9000;

/**
 * After adding a pill: its picture and when the first reminder comes, glowing once in the pill's
 * own colour. Tap to put it away; it goes by itself after a few seconds on Home.
 */
export function AddedCard() {
  const justAdded = useApp((s) => s.justAdded);
  const setJustAdded = useApp((s) => s.setJustAdded);
  const reduced = useReducedMotion();
  const theme = useTheme();
  const [glow] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      if (!justAdded) return;
      if (Date.now() - justAdded.at > FRESH_MS) {
        setJustAdded(null);
        return;
      }
      if (reduced) glow.setValue(0.5);
      else {
        glow.setValue(0);
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
        ]).start();
      }
      const t = setTimeout(() => setJustAdded(null), SHOWN_MS);
      return () => clearTimeout(t);
    }, [justAdded, reduced, glow, setJustAdded]),
  );

  if (!justAdded) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={justAdded.note} accessibilityHint="Puts this note away" onPress={() => setJustAdded(null)}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { boxShadow: `0px 0px 28px 6px ${glowColour(justAdded.colour, theme.accent)}`, opacity: glow }]} />
      <Glass contentStyle={styles.card}>
        <PillPicture form={justAdded.form} colour={justAdded.colour} size={64} glow={false} />
        <AppText style={styles.grow}>{justAdded.note}</AppText>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glow: { borderRadius: radius.card },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  grow: { flex: 1 },
});
