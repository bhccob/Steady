import { useRouter } from 'expo-router';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { levelReason } from '../../src/support/copy';
import { LevelPanel } from '../../src/support/LevelPanel';
import { suggestedLevel } from '../../src/support/level';
import { Button } from '../../src/ui/Button';

export default function LevelStep() {
  const router = useRouter();
  const { conditions, chosenLevel } = useOnboarding((s) => s.draft);
  const patch = useOnboarding((s) => s.patch);
  const suggested = suggestedLevel(conditions);
  const next = () => router.push('/onboarding/sleep');

  return (
    <StepLayout step={7} title="Your support level" subtitle={levelReason(conditions)} footer={<Button label="Continue" onPress={next} />}>
      <LevelPanel level={chosenLevel ?? suggested} suggested={suggested} onChange={(v) => patch({ chosenLevel: v === suggested ? null : v })} />
    </StepLayout>
  );
}
