import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { layout, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary: beige with a 3D press. secondary: glass. link: text only. */
  variant?: 'primary' | 'secondary' | 'link';
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', icon, accessibilityLabel, accessibilityHint, style }: ButtonProps) {
  const theme = useTheme();

  if (variant === 'link') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        hitSlop={8}
        style={[styles.link, style]}
      >
        <AppText tone="secondary">{label}</AppText>
      </Pressable>
    );
  }

  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary
          ? {
              backgroundColor: theme.accent,
              borderBottomColor: theme.accentDeep,
              borderBottomWidth: pressed ? 2 : 5,
              transform: [{ translateY: pressed ? 3 : 0 }],
            }
          : { backgroundColor: theme.glass.overlay, borderWidth: 1, borderColor: theme.glass.border, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon}
        <AppText variant="bodyStrong" style={{ color: primary ? theme.onAccent : theme.text.primary }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.doseButtonHeight,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: layout.minTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
