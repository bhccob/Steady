import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Background } from '../ui/Background';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

/** Steps after the welcome screen. */
export const TOTAL_STEPS = 11;

interface StepLayoutProps {
  /** Onboarding step for the progress line. Settings pages leave it out and show no progress. */
  step?: number;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Pinned under the scrolling content: the step's one button. Optional steps move on when left empty, so there is no Skip. */
  footer?: ReactNode;
}

export function StepLayout({ step, title, subtitle, children, footer }: StepLayoutProps) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Background>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.fill, styles.column, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.barSide}>
              <Icon name="chevron-left" size={26} />
            </Pressable>
            {step === undefined ? (
              <View style={styles.grow} />
            ) : (
              <View
                style={styles.progress}
                accessibilityRole="progressbar"
                accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}
                accessibilityValue={{ min: 0, max: TOTAL_STEPS, now: step }}
              >
                <View style={[styles.progressDone, { width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: theme.accentLine }]} />
              </View>
            )}
            <View style={styles.barSide} />
          </View>

          <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle ? (
              <AppText tone="secondary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
            <View style={styles.body}>{children}</View>
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Background>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.gutter },
  bar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barSide: { width: 56, height: layout.minTarget, justifyContent: 'center' },
  progress: { flex: 1, height: 3, borderRadius: 99, overflow: 'hidden', backgroundColor: TRACK },
  progressDone: { height: '100%', borderRadius: 99 },
  grow: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 24 },
  subtitle: { marginTop: 6 },
  body: { marginTop: 20, gap: 14 },
  footer: { gap: 6, paddingTop: 8 },
});
