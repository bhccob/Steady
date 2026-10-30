import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/app';
import { layout } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { GlowPressable } from './GlowPressable';
import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

/** Space a tab's content leaves at the bottom so the bar, and "Reach out" above it when shown, never cover it. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  const reachOut = useApp((s) => s.supportLevel === 'close' || s.longOverdue);
  return insets.bottom + (reachOut ? 180 : 120);
}

const ICONS: Record<string, IconName> = { home: 'home', calendar: 'calendar', guardians: 'users', settings: 'settings' };

/**
 * Floating glass tab bar with the emergency button beside it, on every tab: crisis
 * help is never more than two taps away. It grows into "Reach out" at close support, and
 * whenever a dose is more than two hours overdue (spec §7.1): more visible, never red or pulsing.
 */
export function FloatingTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const openHelp = useApp((s) => s.openHelp);
  const close = useApp((s) => s.supportLevel === 'close' || s.longOverdue);
  const glass = { backgroundColor: theme.glass.solid, borderColor: theme.glass.border, boxShadow: theme.glass.shadow };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      {/* Phone width at most, centred, so a wide browser window keeps the phone layout. */}
      <View pointerEvents="box-none" style={styles.column}>
        {close ? (
          <GlowPressable
            radius={999}
            accessibilityRole="button"
            accessibilityLabel="Reach out: guardians and crisis lines"
            onPress={() => openHelp('button')}
            style={[styles.reach, glass, { borderColor: theme.accentLine }]}
          >
            <Icon name="life-buoy" size={18} />
            <AppText variant="bodyStrong">Reach out</AppText>
          </GlowPressable>
        ) : null}
        <View style={styles.row}>
          <View style={[styles.bar, glass]} accessibilityRole="tablist">
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const options = descriptors[route.key]?.options;
              return (
                <GlowPressable
                  radius={999}
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={options?.tabBarAccessibilityLabel ?? options?.title ?? route.name}
                  onPress={() => navigateToTab(route.key)}
                  style={[styles.tab, focused && { backgroundColor: theme.background[0] }]}
                >
                  <Icon name={ICONS[route.name] ?? 'circle'} color={focused ? theme.text.primary : theme.text.secondary} />
                </GlowPressable>
              );
            })}
          </View>
          {close ? null : (
            <GlowPressable radius={999} accessibilityRole="button" accessibilityLabel="Emergency and crisis lines" onPress={() => openHelp('button')} style={[styles.sos, glass]}>
              <Icon name="life-buoy" size={20} color={theme.text.secondary} />
            </GlowPressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: 20, gap: 10, alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  bar: { flex: 1, height: 60, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6 },
  tab: { width: 52, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sos: { width: 54, height: 54, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reach: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
