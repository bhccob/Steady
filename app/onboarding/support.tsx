import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { ConditionPicker } from '../../src/support/ConditionPicker';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

export default function SupportStep() {
  const router = useRouter();
  const conditions = useOnboarding((s) => s.draft.conditions);
  const patch = useOnboarding((s) => s.patch);

  const next = () => {
    if (conditions.length) {
      router.push('/onboarding/severity');
      return;
    }
    patch({ chosenLevel: null });
    router.push('/onboarding/sleep');
  };

  return (
    <StepLayout
      step={5}
      title="What are you working through?"
      subtitle="Optional and private. Pick any that fit, or none. It stays on this phone and helps Steady know how closely to look out for you."
      footer={
        <>
          <AppText variant="caption" tone="secondary" style={styles.center} accessibilityLiveRegion="polite">
            {conditions.length ? `${conditions.length} chosen. Next, you'll say how much each one affects you.` : 'Nothing chosen is fine too.'}
          </AppText>
          <Button label="Continue" onPress={next} />
        </>
      }
    >
      <ConditionPicker conditions={conditions} onChange={(next) => patch({ conditions: next })} />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
