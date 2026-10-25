import { StyleSheet, View } from 'react-native';

import { Button } from '../ui/Button';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

/** Sunday's private recap (spec §12.7). One line, then out of the way. */
export function RecapCard({ line, onSeen }: { line: string; onSeen: () => void }) {
  return (
    <Glass contentStyle={styles.card}>
      <View style={styles.top} accessible accessibilityLabel={`Your week. ${line}`}>
        <Icon name="sun" size={24} />
        <View style={styles.grow}>
          <AppText variant="heading">Your week</AppText>
          <AppText tone="secondary">{line}</AppText>
        </View>
      </View>
      <Button variant="link" label="Thanks" accessibilityLabel="Close your week" onPress={onSeen} style={styles.link} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  link: { alignSelf: 'flex-end' },
});
