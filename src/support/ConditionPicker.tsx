import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HAIRLINE, layout } from '../theme/tokens';
import { CheckRow } from '../ui/CheckRow';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { addableName, CONDITIONS, searchConditions } from './conditions';
import type { Condition } from './level';

const KNOWN = new Set(CONDITIONS.map((c) => c.name));

/** Search, grouped rows to tick, and "Add" for anything not listed. New picks start at moderate. */
export function ConditionPicker({ conditions, onChange }: { conditions: readonly Condition[]; onChange: (next: Condition[]) => void }) {
  const [query, setQuery] = useState('');
  // Added this visit; kept in the list even if unticked again.
  const [added, setAdded] = useState<string[]>([]);

  const own = [...new Set([...conditions.map((c) => c.name).filter((n) => !KNOWN.has(n)), ...added])];
  const groups = searchConditions(query, own);
  const toAdd = addableName(query, own);
  const picked = new Set(conditions.map((c) => c.name));

  const toggle = (name: string) => onChange(picked.has(name) ? conditions.filter((c) => c.name !== name) : [...conditions, { name, severity: 1 }]);
  const add = (name: string) => {
    setAdded([...added, name]);
    onChange([...conditions, { name, severity: 1 }]);
    setQuery('');
  };

  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  group: { marginTop: 18, marginBottom: 2 },
  addRow: {
    minHeight: Math.max(layout.minTarget, 50),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
});
