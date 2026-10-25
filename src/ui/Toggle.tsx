import { StyleSheet, Switch, View } from 'react-native';

import { HAIRLINE, TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

/** A labelled switch on a plain hairline row. */
export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.grow}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accentLine, false: TRACK }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={TRACK}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
});
