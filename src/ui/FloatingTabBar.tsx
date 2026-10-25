import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useApp } from '../state/app';
import { layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

const ICONS: Record<string, IconName> = { home: 'home', calendar: 'calendar', guardians: 'users', settings: 'settings' };

/**
 * Floating glass tab bar with the emergency button beside it, on every tab: crisis
 * help is never more than two taps away. At close support it shows as "Reach out".
 */
export function FloatingTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const openHelp = useApp((s) => s.openHelp);
  const close = useApp((s) => s.supportLevel === 'close');
  const glass = { backgroundColor: theme.glass.solid, borderColor: theme.glass.border, boxShadow: theme.glass.shadow };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      {close ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reach out: guardians and crisis lines"
          onPress={() => openHelp('button')}
          style={[styles.reach, glass, { borderColor: theme.accentLine }]}
        >
          <Icon name="life-buoy" size={18} />
          <AppText variant="bodyStrong">Reach out</AppText>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.bar, glass]} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key]?.options;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options?.tabBarAccessibilityLabel ?? options?.title ?? route.name}
                onPress={() => navigateToTab(route.key)}
                style={[styles.tab, focused && { backgroundColor: theme.background[0] }]}
              >
                <Icon name={ICONS[route.name] ?? 'circle'} color={focused ? theme.text.primary : theme.text.secondary} />
              </Pressable>
            );
          })}
        </View>
        {close ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Emergency and crisis lines" onPress={() => openHelp('button')} style={[styles.sos, glass]}>
            <Icon name="life-buoy" size={20} color={theme.text.secondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, gap: 10, alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', maxWidth: layout.maxContentWidth },
  bar: { flex: 1, height: 60, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6 },
  tab: { width: 52, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sos: { width: 54, height: 54, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reach: { height: 46, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
