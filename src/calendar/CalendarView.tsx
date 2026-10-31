import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { DayState, PathEntry } from '../home/path';
import { shortDate, weekdayOf } from '../lib/time';
import { DECOR_FONT_SCALE, HAIRLINE } from '../theme/tokens';
import type { Theme } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import { monthCells, monthOf, monthTally, monthTitle, shiftMonth, tallyWords, type MonthCell, type Tile } from './month';
import type { HistoryData } from './useHistory';

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** A day with nothing marked looks like a day with nothing due: never a failure mark. */
const QUIET = 'rgba(128, 120, 110, 0.09)';

function tileWords(c: MonthCell): string {
  switch (c.tile) {
    case 'full':
      return 'all marked';
    case 'part':
      return `${c.marked} of ${c.due} marked`;
    case 'rest':
      return 'rest day';
    case 'unmarked':
      return 'nothing marked';
    case 'empty':
      return 'nothing due';
    case 'before':
      return 'before you started';
    default:
      return 'still to come';
  }
}

function tileStyle(tile: Tile, t: Theme): ViewStyle {
  switch (tile) {
    case 'full':
      return { backgroundColor: t.accent, borderBottomWidth: 3, borderBottomColor: t.accentDeep };
    case 'part':
      return { backgroundColor: t.glass.solid, borderWidth: 1.5, borderColor: t.accentDeep };
    case 'rest':
      return { borderWidth: 2, borderStyle: 'dashed', borderColor: t.text.secondary };
    case 'ahead':
    case 'before':
      return {};
    default:
      return { backgroundColor: QUIET };
  }
}

function entryFor(c: MonthCell): PathEntry {
  const state: DayState =
    c.tile === 'ahead' ? 'ahead' : c.tile === 'rest' ? 'rest' : c.tile === 'full' || c.tile === 'part' ? 'done' : c.isToday ? 'today' : 'past';
  return { kind: 'day', date: c.date, weekday: WEEKDAY[weekdayOf(c.date)]!, day: c.day, state, isToday: c.isToday };
}

function DayTile({ c, onPress }: { c: MonthCell; onPress: () => void }) {
  const theme = useTheme();
  const onAccent = c.tile === 'full';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[shortDate(c.date), c.isToday ? 'today' : '', tileWords(c)].filter(Boolean).join(', ')}
      accessibilityHint="Shows that day"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, tileStyle(c.tile, theme), c.isToday && { borderWidth: 2.5, borderColor: theme.text.primary }, pressed && styles.pressed]}
    >
      {c.tile === 'part' ? <View style={[styles.fill, { height: `${Math.round(c.fill * 100)}%`, backgroundColor: theme.accent }]} /> : null}
      <AppText
        maxFontSizeMultiplier={DECOR_FONT_SCALE}
        tone={onAccent || c.tile === 'part' ? 'primary' : 'secondary'}
        style={[styles.num, onAccent && { color: theme.onAccent }, (c.tile === 'ahead' || c.tile === 'before') && styles.faint]}
      >
        {c.day}
      </AppText>
      {onAccent ? (
        <View style={styles.check}>
          <Icon name="check" size={12} color={theme.onAccent} />
        </View>
      ) : null}
    </Pressable>
  );
}

interface CalendarViewProps {
  data: HistoryData;
  onOpenDay: (entry: PathEntry) => void;
}

/** The month as tiles you can read at a glance: full days full, partly marked days filled part way. */
export function CalendarView({ data, onOpenDay }: CalendarViewProps) {
  const theme = useTheme();
  const [month, setMonth] = useState(monthOf(data.today));
  const first = monthOf(data.firstDay);
  const last = monthOf(data.today);
  const canBack = month > first;
  const canNext = month < last;

  // Swipe sideways on the grid to change month.
  const nav = useRef({ canBack, canNext });
  useLayoutEffect(() => {
    nav.current = { canBack, canNext };
  });
  // The handlers read `nav` only when a swipe happens, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && nav.current.canNext) setMonth((m) => shiftMonth(m, 1));
        if (g.dx > 50 && nav.current.canBack) setMonth((m) => shiftMonth(m, -1));
      },
    }),
  );

  const { leading, cells } = monthCells({ month, today: data.today, firstDay: data.firstDay, doses: data.doses });
  const slots: (MonthCell | null)[] = [...Array<null>(leading).fill(null), ...cells];
  while (slots.length % 7) slots.push(null);
  const weeks = Array.from({ length: slots.length / 7 }, (_, i) => slots.slice(i * 7, i * 7 + 7));

  const tally = monthTally(cells);
  const words = tallyWords(tally);
  const counted = tally.full + tally.part + tally.rest + tally.unmarked;
  const segments = [
    { n: tally.full, color: theme.accentDeep },
    { n: tally.part, color: theme.accent },
    { n: tally.rest, color: theme.chart.none },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {monthTitle(month, data.today)}
        </AppText>
        <View style={styles.arrows}>
          {[
            { icon: 'chevron-left' as const, enabled: canBack, label: monthTitle(shiftMonth(month, -1), data.today), go: -1 },
            { icon: 'chevron-right' as const, enabled: canNext, label: monthTitle(shiftMonth(month, 1), data.today), go: 1 },
          ].map((a) => (
            <Pressable
              key={a.icon}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ disabled: !a.enabled }}
              disabled={!a.enabled}
              onPress={() => setMonth(shiftMonth(month, a.go))}
              style={[styles.arrow, { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border, opacity: a.enabled ? 1 : 0.35 }]}
            >
              <Icon name={a.icon} size={18} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.summary} accessible accessibilityLabel={words ?? 'Nothing marked yet this month.'}>
        <AppText variant="bodyStrong">{words ?? 'Nothing marked yet this month.'}</AppText>
        {counted ? (
          <View style={[styles.bar, { backgroundColor: HAIRLINE }]}>
            {segments.map((s, i) => (s.n ? <View key={i} style={{ flex: s.n, backgroundColor: s.color }} /> : null))}
            {tally.unmarked ? <View style={{ flex: tally.unmarked }} /> : null}
          </View>
        ) : null}
      </View>

      <View {...pan.panHandlers} style={styles.grid}>
        <View style={styles.row}>
          {WEEK_LETTERS.map((l, i) => (
            <AppText key={i} variant="label" tone="secondary" style={styles.letter} importantForAccessibility="no">
              {l}
            </AppText>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.row}>
            {week.map((c, i) => (c ? <DayTile key={c.date} c={c} onPress={() => onOpenDay(entryFor(c))} /> : <View key={`blank-${i}`} style={styles.blank} />))}
          </View>
        ))}
      </View>

      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.swatch, tileStyle('full', theme), styles.swatchFlat]} />
          <AppText variant="caption" tone="secondary">
            all marked
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, tileStyle('part', theme)]}>
            <View style={[styles.fill, { height: '50%', backgroundColor: theme.accent }]} />
          </View>
          <AppText variant="caption" tone="secondary">
            some
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, tileStyle('rest', theme), styles.swatchThin]} />
          <AppText variant="caption" tone="secondary">
            rest
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arrows: { flexDirection: 'row', gap: 6 },
  arrow: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: 8 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden' },
  grid: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  letter: { flex: 1, textAlign: 'center' },
  blank: { flex: 1, aspectRatio: 1 },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', padding: 5 },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  num: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  faint: { opacity: 0.45 },
  check: { position: 'absolute', right: 5, bottom: 4 },
  pressed: { opacity: 0.7 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4, overflow: 'hidden' },
  swatchFlat: { borderBottomWidth: 0 },
  swatchThin: { borderWidth: 1.5 },
});
