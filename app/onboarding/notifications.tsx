import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { requestPermissionsAsync } from '../../src/lib/notifications';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { LEVEL_RULES, suggestedLevel } from '../../src/support/level';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/ui/Button';
import { Glass } from '../../src/ui/Glass';
import { Icon } from '../../src/ui/Icon';
import { AppText } from '../../src/ui/Text';

export default function NotificationsStep() {
  const router = useRouter();
  const theme = useTheme();
  const { name, conditions, chosenLevel } = useOnboarding((s) => s.draft);
  const level = chosenLevel ?? suggestedLevel(conditions);
  const next = () => router.push('/onboarding/legal');
  const preview = name.trim() ? `${name.trim()}, a small mark when you're ready.` : "a small mark when you're ready.";

  const allow = async () => {
    try {
      await requestPermissionsAsync();
    } finally {
      next();
    }
  };

  return (
    <StepLayout
      step={10}
      title="Gentle reminders"
      subtitle="You can mark a dose right from the notification."
      footer={
        <>
          <AppText variant="caption" tone="secondary" style={styles.center}>
            Your phone will ask next. Saying no is fine.
          </AppText>
          <Button label="Continue" onPress={allow} />
        </>
      }
    >
      <Glass contentStyle={styles.card} accessible accessibilityLabel={`Example notification: ${preview} Buttons: Taken, Snooze 30.`}>
        <View style={styles.appRow}>
          <View style={[styles.appIcon, { backgroundColor: theme.accent, borderColor: theme.accentLine }]} />
          <AppText variant="label">Steady</AppText>
          <AppText variant="caption" tone="secondary" style={styles.now}>
            now
          </AppText>
        </View>
        <AppText>{preview}</AppText>
        <View style={styles.actions}>
          <View style={[styles.action, { backgroundColor: theme.accent }]}>
            <AppText variant="bodyStrong" style={{ color: theme.onAccent }}>
              Taken
            </AppText>
          </View>
          <View style={[styles.action, { borderWidth: 1, borderColor: theme.glass.border }]}>
            <AppText>Snooze 30</AppText>
          </View>
        </View>
      </Glass>
      <View style={styles.lines}>
        <View style={styles.line}>
          <Icon name="bell" />
          <AppText style={styles.grow}>At most {LEVEL_RULES[level].remindersPerDose} per dose, then quiet.</AppText>
        </View>
        <View style={styles.line}>
          <Icon name="lock" />
          <AppText style={styles.grow}>{"Never your med's name on the lock screen."}</AppText>
        </View>
        <View style={styles.line}>
          <Icon name="moon" />
          <AppText style={styles.grow}>Follow-ups wait until your quiet hours end.</AppText>
        </View>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appIcon: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5 },
  now: { marginLeft: 'auto' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  lines: { gap: 14, marginTop: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
});
