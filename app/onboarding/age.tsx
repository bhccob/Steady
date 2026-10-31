import { useRouter } from 'expo-router';
import { useState } from 'react';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';

export default function AgeStep() {
  const router = useRouter();
  const patch = useOnboarding((s) => s.patch);
  const [under18, setUnder18] = useState(false);

  return (
    <StepLayout
      step={1}
      title="Are you 18 or older?"
      subtitle="Steady is made for adults. This step can't be skipped."
      footer={
        under18 ? null : (
          <>
            <Button
              label="Yes, I'm 18 or older"
              onPress={() => {
                patch({ ageConfirmed: true });
                router.push('/onboarding/legal');
              }}
            />
            <Button variant="secondary" label="I'm under 18" onPress={() => setUnder18(true)} />
          </>
        )
      }
    >
      {under18 ? (
        <AppText accessibilityLiveRegion="polite">
          {
            "Steady is made for adults, so it can't continue. A doctor, a pharmacist, or someone you trust can help you set up reminders. If you're in danger right now, call your local emergency number."
          }
        </AppText>
      ) : null}
    </StepLayout>
  );
}
