import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DraftGuardian } from '../../src/onboarding/draft';
import { guardianButton } from '../../src/onboarding/guardianStep';
import { CHANNELS, CONTACT_FIELD, RELATIONSHIPS } from '../../src/onboarding/options';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { Dropdown } from '../../src/ui/Dropdown';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

export default function GuardianStep() {
  const router = useRouter();
  const saved = useOnboarding((s) => s.draft.guardian);
  const patch = useOnboarding((s) => s.patch);
  const [g, setG] = useState<DraftGuardian>(saved ?? { name: '', relationship: 'Friend', channel: 'whatsapp', contact: '' });
  const [hint, setHint] = useState('');
  const contact = CONTACT_FIELD[g.channel];
  const button = guardianButton(g);

  const onPress = () => {
    if (button.action === 'needs_name') {
      setHint('Add their name first.');
      return;
    }
    patch({ guardian: button.action === 'add' ? g : null });
    router.push('/onboarding/notifications');
  };

  return (
    <StepLayout
      step={9}
      title="Someone in your corner?"
      subtitle="Optional. They only hear from Steady when you ask. Never about a missed dose."
      footer={<Button label={button.label} onPress={onPress} />}
    >
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="Their name"
            placeholder="Alex"
            value={g.name}
            onChangeText={(name) => {
              setHint('');
              setG({ ...g, name });
            }}
            maxLength={40}
          />
        </View>
        <View style={styles.half}>
          <Dropdown label="Who they are" value={g.relationship} options={RELATIONSHIPS} onChange={(relationship) => setG({ ...g, relationship })} />
        </View>
      </View>
      <Dropdown label="How to reach them" value={g.channel} options={CHANNELS} onChange={(channel) => setG({ ...g, channel, contact: '' })} />
      <TextField
        label={contact.label}
        placeholder={contact.placeholder}
        hint={g.channel === 'inapp' ? 'Connecting inside Steady needs accounts, which are coming later. Pick another way for now.' : contact.hint}
        value={g.contact}
        onChangeText={(c) => setG({ ...g, contact: c })}
        keyboardType={contact.phone ? 'phone-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AppText variant="caption" tone="secondary">
        {"They're asked to accept before they can be reached. Either of you can stop any time."}
      </AppText>
      {hint ? (
        <AppText accessibilityLiveRegion="polite" accessibilityRole="alert">
          {hint}
        </AppText>
      ) : null}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
