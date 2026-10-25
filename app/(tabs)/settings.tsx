import { StyleSheet } from 'react-native';

import { Glass } from '../../src/ui/Glass';
import { Screen } from '../../src/ui/Screen';
import { AppText } from '../../src/ui/Text';

export default function SettingsScreen() {
  return (
    <Screen>
      <Glass contentStyle={styles.card}>
        <AppText variant="title">Settings</AppText>
        <AppText tone="secondary">Quiet hours, export and delete land in later P0 steps.</AppText>
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 8 },
});
