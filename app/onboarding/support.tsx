import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { supportStepNote } from '../../src/account/copy';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { useApp } from '../../src/state/app';
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

  const signedIn = useApp((s) => s.account !== null);

  return (
    <StepLayout
      step={5}
      title="What are you working through?"
      subtitle={supportStepNote(signedIn)}
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
