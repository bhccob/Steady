import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Mood } from '../db/schema';
import { usePerf } from '../lib/perf';
import { useReducedMotion } from '../lib/useReducedMotion';
import { layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from '../ui/Button';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/Text';

const FACES: { mood: Mood; icon: IconName }[] = [
  { mood: 'happy', icon: 'smile' },
  { mood: 'okay', icon: 'meh' },
  { mood: 'rough', icon: 'frown' },
];

interface MoodPromptProps {
  visible: boolean;
  name: string;
  hour: number;
  onPick: (mood: Mood) => void;
  onDismiss: () => void;
  /** Called once the prompt has faded out, with the mood picked (or null for "Not now"). */
  onDone: (mood: Mood | null) => void;
  /** Close's evening check-in: asks about the evening instead of the day. */
  evening?: boolean;
}

/** First open of the day: "How's today?" Open and box-free; one tap and it's gone until tomorrow. */
export function MoodPrompt({ visible, name, hour, onPick, onDismiss, onDone, evening = false }: MoodPromptProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const glassMode = usePerf((s) => s.glassMode);
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Mood | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));

  // Start fresh each time the prompt opens.
  const [openedFor, setOpenedFor] = useState(visible);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) setPicked(null);
  }
  useEffect(() => {
    if (visible) opacity.setValue(1);
  }, [visible, opacity]);

  const close = (mood: Mood | null, delay: number) => {
    setTimeout(() => {
      if (reduced) onDone(mood);
      else Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone(mood));
    }, delay);
  };

  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const title = picked ? 'Noted.' : name.trim() ? `${greeting}, ${name.trim()}.` : `${greeting}.`;
  const sub = evening
    ? picked
      ? picked === 'rough'
        ? "Go easy tonight. We're here."
        : 'Rest well tonight.'
      : "How's this evening?"
    : picked
      ? picked === 'rough'
        ? "Go easy today. We're here."
        : 'Have a gentle day.'
      : "How's today?";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { onDismiss(); close(null, 0); }} statusBarTranslucent>
      <Animated.View style={[styles.fill, { opacity }]}>
        {glassMode === 'blur' ? (
          <BlurView intensity={18} tint={theme.name} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.solid }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundImage: `linear-gradient(to bottom, transparent, ${theme.glass.solid} 45%, ${theme.background[1]})` }]} />
        <View style={[styles.content, { paddingBottom: insets.bottom + 28 }]} accessibilityViewIsModal>
          <View style={styles.text}>
            <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
              {title}
            </AppText>
            <AppText tone="secondary" style={styles.sub}>
              {sub}
            </AppText>
          </View>
          {picked ? null : (
            <>
              <View style={styles.faces}>
                {FACES.map((f) => (
                  <Pressable
                    key={f.mood}
                    accessibilityRole="button"
                    accessibilityLabel={f.mood}
                    onPress={() => {
                      setPicked(f.mood);
                      onPick(f.mood);
                      close(f.mood, 1000);
                    }}
                    style={({ pressed }) => [styles.face, pressed && { backgroundColor: theme.glass.overlay, transform: [{ scale: 0.96 }] }]}
                  >
                    <Icon name={f.icon} size={46} />
                    <AppText>{f.mood}</AppText>
                  </Pressable>
                ))}
              </View>
              <Button
                variant="link"
                label="Not now"
                onPress={() => {
                  onDismiss();
                  close(null, 0);
                }}
              />
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, gap: 22, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  text: { gap: 4 },
  sub: { fontSize: 17 },
  faces: { flexDirection: 'row', gap: 4, marginHorizontal: -8 },
  face: { flex: 1, minHeight: 104, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
