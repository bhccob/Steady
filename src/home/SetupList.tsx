import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { useApp } from '../state/app';
import { HAIRLINE, layout, motion, radius, TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from '../ui/Button';
import { Glass } from '../ui/Glass';
import { GlowPressable } from '../ui/GlowPressable';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/Text';
import type { SetupRow, SetupStep } from './setup';

const STEPS: Record<SetupStep, { title: string; icon: IconName }> = {
  pill: { title: 'Add your first pill', icon: 'plus' },
  reminders: { title: 'Turn on reminders', icon: 'bell' },
  support: { title: 'Your support level', icon: 'heart' },
  sleep: { title: 'Bedtime', icon: 'moon' },
  someone: { title: 'Someone close', icon: 'user' },
};

function hintFor(step: SetupStep, signedIn: boolean): string {
  switch (step) {
    case 'pill':
      return 'What it is, when you take it, how it looks.';
    case 'reminders':
      if (Platform.OS !== 'web') return 'A gentle nudge at each time. Your phone will ask.';
      // Signed in, the same server also keeps the backup, so "only" would not be true.
      return signedIn ? "Your phone will ask. Steady's server keeps when they're due." : "Your phone will ask. Steady's server keeps only when they're due.";
    case 'support':
      return "Say what you're working through, if you like. It sets how closely Steady checks in.";
    case 'sleep':
      return 'A nudge toward bed, then quiet until you wake.';
    case 'someone':
      return 'A person you trust, one tap away.';
  }
}

interface SetupListProps {
  rows: SetupRow[];
  /** Why reminders didn't turn on, shown under that step. */
  remindNote: string;
  onOpen: (step: SetupStep) => void;
  onHide: () => void;
}

/** Home's Get set up list: the steps setup no longer asks, ticked off as they're done. */
export function SetupList({ rows, remindNote, onOpen, onHide }: SetupListProps) {
  const theme = useTheme();
  const signedIn = useApp((s) => s.account !== null);
  const done = rows.filter((r) => r.done).length;
  const next = rows.find((r) => !r.done)?.step;

  return (
    <Glass contentStyle={styles.card}>
      <View style={styles.head} accessible accessibilityRole="header" accessibilityLabel={`Get set up. ${done} of ${rows.length} done.`}>
        <AppText variant="heading">Get set up</AppText>
        <AppText variant="caption" tone="secondary">
          {done} of {rows.length}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: TRACK }]}>
        <View style={[styles.fill, { width: `${(done / rows.length) * 100}%`, backgroundColor: theme.accentLine }]} />
      </View>

      <View>
        {rows.map((r, i) => (
          <Step
            key={r.step}
            row={r}
            next={r.step === next}
            first={i === 0}
            hint={hintFor(r.step, signedIn)}
            note={r.step === 'reminders' ? remindNote : ''}
            onPress={() => onOpen(r.step)}
          />
        ))}
      </View>

      <View style={styles.foot}>
        <Button variant="link" label="Hide this list" onPress={onHide} />
        <AppText variant="caption" tone="secondary" style={styles.grow}>
          You can still do these in Settings and Guardians.
        </AppText>
      </View>
    </Glass>
  );
}

interface StepProps {
  row: SetupRow;
  next: boolean;
  first: boolean;
  hint: string;
  note: string;
  onPress: () => void;
}

function Step({ row, next, first, hint, note, onPress }: StepProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { title, icon } = STEPS[row.step];
  // The check pops in when a step gets done while Home is open, not for steps done before.
  const [pop] = useState(() => new Animated.Value(1));
  const wasDone = useRef(row.done);
  useEffect(() => {
    if (row.done && !wasDone.current && !reduced) {
      pop.setValue(0.4);
      Animated.spring(pop, { toValue: 1, useNativeDriver: Platform.OS !== 'web', ...motion.spring }).start();
    }
    wasDone.current = row.done;
  }, [row.done, reduced, pop]);

  const rule = first ? null : { borderTopWidth: 1, borderTopColor: HAIRLINE };

  if (row.done) {
    return (
      <View style={[styles.row, rule]} accessible accessibilityLabel={`${title}, done`}>
        <Animated.View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.accentLine, transform: [{ scale: pop }] }]}>
          <Icon name="check" size={16} color={theme.onAccent} />
        </Animated.View>
        <AppText tone="secondary" style={styles.grow}>
          {title}
        </AppText>
      </View>
    );
  }

  return (
    <GlowPressable radius={radius.control} accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} style={[styles.row, rule]}>
      <View style={[styles.badge, next ? { borderWidth: 2, borderColor: theme.accentLine } : { borderColor: TRACK }]}>
        <Icon name={icon} size={16} color={next ? theme.text.primary : theme.text.secondary} />
      </View>
      <View style={styles.grow}>
        <AppText variant={next ? 'bodyStrong' : 'body'}>{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
        {note ? (
          <AppText variant="caption" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.note}>
            {note}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={theme.text.secondary} />
    </GlowPressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  track: { height: 3, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 999 },
  row: { minHeight: Math.max(layout.minTarget, 56), flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  badge: { width: 32, height: 32, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  note: { marginTop: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
