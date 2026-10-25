import { StyleSheet, View } from 'react-native';

import { Button } from '../ui/Button';
import { Glass } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import type { BedtimeCard as Kind } from './bedtime';

const COPY: Record<Exclude<Kind, null>, { title: string; sub: string }> = {
  soon: { title: 'Bedtime soon', sub: 'A good time to start winding down.' },
  past: { title: "It's past your bedtime", sub: 'Rest now helps tomorrow feel steadier.' },
};

/** From wind-down until wake-up: Goodnight quiets Steady until morning; "15 more min" asks again later. */
export function BedtimeCard({ kind, onGoodnight, onMoreTime }: { kind: Exclude<Kind, null>; onGoodnight: () => void; onMoreTime: () => void }) {
  return (
    <Glass contentStyle={styles.card}>
      <View style={styles.top} accessible accessibilityLabel={`${COPY[kind].title}. ${COPY[kind].sub}`}>
        <Icon name="moon" size={26} />
        <View style={styles.grow}>
          <AppText variant="heading">{COPY[kind].title}</AppText>
          <AppText variant="caption" tone="secondary">
            {COPY[kind].sub}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Goodnight" accessibilityHint="Quiet until your wake-up time" onPress={onGoodnight} style={styles.grow} />
        <Button variant="link" label="15 more min" onPress={onMoreTime} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
