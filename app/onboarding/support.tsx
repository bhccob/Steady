import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { addableName, CONDITIONS, searchConditions } from '../../src/support/conditions';
import { layout } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { CheckRow } from '../../src/ui/CheckRow';
import { Icon } from '../../src/ui/Icon';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

const KNOWN = new Set(CONDITIONS.map((c) => c.name));

export default function SupportStep() {
  const router = useRouter();
  const conditions = useOnboarding((s) => s.draft.conditions);
  const patch = useOnboarding((s) => s.patch);
  const [query, setQuery] = useState('');
  // Added this visit; kept in the list even if unticked again.
  const [added, setAdded] = useState<string[]>([]);

  const own = [...new Set([...conditions.map((c) => c.name).filter((n) => !KNOWN.has(n)), ...added])];
  const groups = searchConditions(query, own);
  const toAdd = addableName(query, own);
  const picked = new Set(conditions.map((c) => c.name));

  const toggle = (name: string) =>
    patch({ conditions: picked.has(name) ? conditions.filter((c) => c.name !== name) : [...conditions, { name, severity: 1 }] });
  const add = (name: string) => {
    setAdded([...added, name]);
    patch({ conditions: [...conditions, { name, severity: 1 }] });
    setQuery('');
  };
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
      <TextField label="Search or add your own" placeholder="Search" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
      <View>
        {toAdd ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Add ${toAdd}`} onPress={() => add(toAdd)} style={styles.addRow}>
            <AppText variant="bodyStrong" style={styles.grow}>
              Add “{toAdd}”
            </AppText>
            <Icon name="plus" size={20} />
          </Pressable>
        ) : null}
        {groups.map((g) => (
          <View key={g.title}>
            <AppText variant="label" tone="secondary" accessibilityRole="header" style={styles.group}>
              {g.title}
            </AppText>
            {g.names.map((name) => (
              <CheckRow key={name} label={name} checked={picked.has(name)} onToggle={() => toggle(name)} />
            ))}
          </View>
        ))}
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  grow: { flex: 1 },
  group: { marginTop: 18, marginBottom: 2 },
  addRow: {
    minHeight: Math.max(layout.minTarget, 50),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27, 22, 19, 0.08)',
  },
});
