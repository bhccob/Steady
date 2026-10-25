import { useRouter } from 'expo-router';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { SeverityPicker } from '../../src/ui/SeverityPicker';
import { AppText } from '../../src/ui/Text';

export default function SeverityStep() {
  const router = useRouter();
  const conditions = useOnboarding((s) => s.draft.conditions);
  const patch = useOnboarding((s) => s.patch);
  const next = () => router.push('/onboarding/level');

  return (
    <StepLayout
      step={6}
      title="How much is it affecting you?"
      subtitle="A rough guess is fine. You can change it any time."
      footer={<Button label="Continue" onPress={next} />}
    >
      {conditions.map((c) => (
        <SeverityPicker
          key={c.name}
          name={c.name}
          value={c.severity}
          onChange={(severity) => patch({ conditions: conditions.map((x) => (x.name === c.name ? { ...x, severity } : x)) })}
        />
      ))}
      <AppText variant="caption" tone="secondary">
        If a doctor has told you how serious it is, go with what they said.
      </AppText>
    </StepLayout>
  );
}
