import { StyleSheet } from 'react-native';

import { Glass } from '../../src/ui/Glass';
import { Screen } from '../../src/ui/Screen';
import { AppText } from '../../src/ui/Text';

export default function GuardiansScreen() {
  return (
    <Screen>
      <Glass contentStyle={styles.card}>
        <AppText variant="title">Guardians</AppText>
        <AppText tone="secondary">Crisis lines land with the emergency sheet; guardian invites in P1.</AppText>
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 8 },
});
