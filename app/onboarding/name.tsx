import { useRouter } from 'expo-router';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';

export default function NameStep() {
  const router = useRouter();
  const name = useOnboarding((s) => s.draft.name);
  const patch = useOnboarding((s) => s.patch);
  const next = () => router.push('/onboarding/age');

  return (
    <StepLayout step={1} title="What should we call you?" subtitle="A first name or a nickname. Optional." footer={<Button label="Continue" onPress={next} />}>
      <TextField
        label="Your name"
        placeholder="sam"
        value={name}
        onChangeText={(t) => patch({ name: t })}
        autoComplete="given-name"
        returnKeyType="next"
        onSubmitEditing={next}
        maxLength={40}
      />
    </StepLayout>
  );
}
