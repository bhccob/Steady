import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';
import { AppText } from './Text';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

/** A frosted sheet from the bottom. Tap outside, the close button, or back to dismiss. */
export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.glass.solid, borderColor: theme.glass.border, paddingBottom: insets.bottom + 16 }]}
        >
          <View style={[styles.grab, { backgroundColor: theme.text.secondary }]} />
          <View style={styles.head}>
            <AppText variant="heading" accessibilityRole="header" style={styles.grow}>
              {title}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Icon name="x" size={20} />
            </Pressable>
          </View>
          {subtitle ? (
            <AppText tone="secondary" style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
          <ScrollView style={styles.body}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** A plain hairline row inside a sheet: icon, label, optional hint, chevron. */
export function SheetRow({ icon, label, hint, onPress, last }: { icon?: Parameters<typeof Icon>[0]['name']; label: string; hint?: string; onPress?: () => void; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, !last && styles.hairline]}
    >
      {icon ? <Icon name={icon} /> : null}
      <View style={styles.grow}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={theme.text.secondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(27, 22, 19, 0.2)' },
  sheet: { maxHeight: '85%', marginHorizontal: 10, marginBottom: 10, borderRadius: 32, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 99, opacity: 0.4, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTarget },
  close: { width: layout.minTarget, height: layout.minTarget, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  subtitle: { marginTop: 2 },
  body: { marginTop: 8 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  hairline: { borderBottomWidth: 1, borderBottomColor: 'rgba(27, 22, 19, 0.08)' },
  grow: { flex: 1 },
});
