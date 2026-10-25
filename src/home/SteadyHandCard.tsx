import { Pressable, StyleSheet, View } from 'react-native';

import type { Window } from '../patterns/windows';
import { layout } from '../theme/tokens';
import { Button } from '../ui/Button';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

/** Where the harder time came from, in the user's own terms. Never a prediction. */
const WHY: Record<Window['source'], string> = {
  yours: 'You set this as one of your harder times.',
  moods: 'Rough days have often landed around now.',
  doses: 'This time of the week has often been harder.',
};

interface SteadyHandCardProps {
  source: Window['source'];
  /** Who "Message" reaches; without one, the third way out opens the help sheet. */
  guardianName: string | null;
  onMark: () => void;
  onBreathe: () => void;
  onReachOut: () => void;
  onDismiss: () => void;
}

/** Spec §6.4: in a harder time with a dose open, exactly three ways out. No streak, no score. */
export function SteadyHandCard({ source, guardianName, onMark, onBreathe, onReachOut, onDismiss }: SteadyHandCardProps) {
  return (
    <Glass contentStyle={styles.card}>
      <View style={styles.top}>
        <Icon name="feather" size={24} />
        <View style={styles.grow} accessible accessibilityLabel={`A steady minute. ${WHY[source]} Whatever helps right now.`}>
          <AppText variant="heading">A steady minute</AppText>
          <AppText variant="caption" tone="secondary">
            {WHY[source]} Whatever helps right now.
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onDismiss} hitSlop={8} style={styles.close}>
          <Icon name="x" size={18} />
        </Pressable>
      </View>
      <Button label="Mark taken" onPress={onMark} />
      <Button variant="secondary" label="60-second breathing" icon={<Icon name="wind" size={18} />} onPress={onBreathe} />
      <Button variant="link" label={guardianName ? `Message ${guardianName}` : 'Reach out'} onPress={onReachOut} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  grow: { flex: 1 },
  close: { width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
});
