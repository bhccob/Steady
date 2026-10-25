import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MED_FORMS, PILL_COLOURS } from '../../src/onboarding/options';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { Button } from '../../src/ui/Button';
import { Dropdown } from '../../src/ui/Dropdown';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

export default function MedsStep() {
  const router = useRouter();
  const meds = useOnboarding((s) => s.draft.meds);
  const { addMed, updateMed, removeMed } = useOnboarding.getState();

  return (
    <StepLayout
      step={3}
      title="What do you take?"
      subtitle={'A name is optional. "my pill" works fine.'}
      footer={<Button label="Continue" onPress={() => router.push(meds.length ? '/onboarding/schedule' : '/onboarding/support')} />}
    >
      {meds.map((m, i) => (
        <View key={m.key} style={[styles.med, i > 0 && styles.divider]}>
          {meds.length > 1 ? (
            <View style={styles.head}>
              <AppText variant="label" tone="secondary">
                Med {i + 1}
              </AppText>
              <Button variant="link" label="Remove" accessibilityLabel={`Remove med ${i + 1}`} onPress={() => removeMed(m.key)} />
            </View>
          ) : null}
          <View style={styles.row}>
            <View style={styles.wide}>
              <TextField label="Name (optional)" placeholder="my pill" value={m.label} onChangeText={(t) => updateMed(m.key, { label: t })} maxLength={40} />
            </View>
            <View style={styles.narrow}>
              <TextField label="Amount" placeholder="1 tablet" value={m.amount} onChangeText={(t) => updateMed(m.key, { amount: t })} maxLength={30} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Dropdown label="Form" value={m.form} options={MED_FORMS} onChange={(v) => updateMed(m.key, { form: v })} />
            </View>
            <View style={styles.half}>
              <Dropdown label="Colour" value={m.color} options={PILL_COLOURS} onChange={(v) => updateMed(m.key, { color: v })} />
            </View>
          </View>
        </View>
      ))}
      <Button variant="link" label="+ Add another med" onPress={addMed} style={styles.add} />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  med: { gap: 14 },
  divider: { borderTopWidth: 1, borderTopColor: 'rgba(27, 22, 19, 0.08)', paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 10 },
  wide: { flex: 3 },
  narrow: { flex: 2 },
  half: { flex: 1 },
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
