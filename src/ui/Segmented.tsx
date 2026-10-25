import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.wrap, { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.seg, on && { backgroundColor: theme.background[0], boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)' }]}
          >
            <AppText variant={on ? 'bodyStrong' : 'body'} style={styles.text}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: 999, borderWidth: 1, gap: 4 },
  seg: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15 },
});
