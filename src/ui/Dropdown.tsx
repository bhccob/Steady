import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';
import { AppText } from './Text';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** A colour, or a CSS gradient for two-tone. */
  swatch?: string;
}

interface DropdownProps<T extends string> {
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
}

function Swatch({ swatch }: { swatch: string }) {
  const fill = swatch.startsWith('linear-gradient') ? { backgroundImage: swatch } : { backgroundColor: swatch };
  return <View style={[styles.swatch, fill]} />;
}

/** A field that opens a short list instead of laying every choice out on screen. */
export function Dropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current.label}`}
        accessibilityHint="Opens a list of choices"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border }]}
      >
        {current.swatch ? <Swatch swatch={current.swatch} /> : null}
        <AppText style={styles.grow} numberOfLines={1}>
          {current.label}
        </AppText>
        <Icon name="chevron-down" size={18} color={theme.text.secondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close list" style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.glass.solid, borderColor: theme.glass.border, boxShadow: theme.glass.shadow }]}>
            <AppText variant="heading" style={styles.sheetTitle}>
              {label}
            </AppText>
            <ScrollView>
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={[styles.option, selected && { backgroundColor: theme.accent }]}
                  >
                    {o.swatch ? <Swatch swatch={o.swatch} /> : null}
                    <AppText variant={selected ? 'bodyStrong' : 'body'} style={[styles.grow, selected && { color: theme.onAccent }]}>
                      {o.label}
                    </AppText>
                    {selected ? <Icon name="check" size={18} color={theme.onAccent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  swatch: { width: 20, height: 20, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(27, 22, 19, 0.22)' },
  scrim: { flex: 1, backgroundColor: 'rgba(27, 22, 19, 0.25)', justifyContent: 'flex-end', padding: 12 },
  sheet: { maxHeight: '70%', borderRadius: 28, borderWidth: 1, padding: 10 },
  sheetTitle: { paddingHorizontal: 10, paddingVertical: 8 },
  option: { minHeight: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
