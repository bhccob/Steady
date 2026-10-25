import { useRouter } from 'expo-router';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { suggestedLevel } from '../../src/support/level';
import { SleepForm } from '../../src/support/SleepForm';
import { Button } from '../../src/ui/Button';

export default function SleepStep() {
  const router = useRouter();
  const { sleep, conditions, chosenLevel } = useOnboarding((s) => s.draft);
  const patch = useOnboarding((s) => s.patch);

  return (
    <StepLayout
      step={8}
      title="Sleep"
      subtitle="Rest helps steady days. Steady can nudge you toward bed."
      footer={<Button label="Continue" onPress={() => router.push('/onboarding/guardian')} />}
    >
      <SleepForm sleep={sleep} level={chosenLevel ?? suggestedLevel(conditions)} onChange={(next) => patch({ sleep: next })} />
    </StepLayout>
  );
}
