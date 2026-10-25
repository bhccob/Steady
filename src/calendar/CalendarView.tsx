import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { DayState, PathEntry } from '../home/path';
import { shortDate, weekdayOf } from '../lib/time';
import { steadyScore } from '../scoring/score';
import { totalDaysMarked } from '../scoring/streak';
import type { Theme } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { AppText } from '../ui/Text';
import { densityCells, monthCells, monthOf, monthTitle, shiftMonth, type CalendarRing, type MonthCell } from './month';
import type { HistoryData } from './useHistory';

type Span = 'month' | '14' | '30' | '90';
const SPANS: { value: Span; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];
const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RING_WORDS: Record<CalendarRing, string> = {
  full: 'all marked',
  half: 'some marked',
  hollow: 'rest day',
  dot: 'mood only',
  open: 'still to come',
  empty: '',
};

function ringStyle(ring: CalendarRing, t: Theme): ViewStyle {
  switch (ring) {
    case 'full':
      return { backgroundColor: t.accent, borderWidth: 1.5, borderColor: t.accentLine };
    case 'half':
      return { borderWidth: 1.5, borderColor: t.accentLine, backgroundImage: `linear-gradient(90deg, ${t.accent} 50%, transparent 50%)` };
    case 'hollow':
      return { borderWidth: 2.5, borderColor: t.text.secondary };
    case 'dot':
      return { width: 6, height: 6, margin: 5, backgroundColor: t.text.secondary };
    case 'open':
      return { borderWidth: 2, borderColor: t.accentLine, borderStyle: 'dashed' };
    default:
      return {};
  }
}

function Ring({ ring, size = 16 }: { ring: CalendarRing; size?: number }) {
  const theme = useTheme();
  return <View style={[{ width: size, height: size, borderRadius: 999 }, ringStyle(ring, theme)]} />;
}

function entryFor(c: MonthCell, today: string): PathEntry {
  const state: DayState =
    c.date > today ? 'ahead' : c.ring === 'hollow' ? 'rest' : c.ring === 'full' || c.ring === 'half' ? 'done' : c.isToday ? 'today' : 'past';
  return { kind: 'day', date: c.date, weekday: WEEKDAY[weekdayOf(c.date)]!, day: c.day, state, isToday: c.isToday };
}

interface CalendarViewProps {
  data: HistoryData;
  onOpenDay: (entry: PathEntry) => void;
}

/** Month rings with a day sheet on tap, or a 14/30/90-day density view. */
export function CalendarView({ data, onOpenDay }: CalendarViewProps) {
  const theme = useTheme();
  const [month, setMonth] = useState(monthOf(data.today));
  const [span, setSpan] = useState<Span>('month');
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

  const moodDates = new Set(data.checkins.map((c) => c.dateLocal));
  const { leading, cells } = monthCells({ month, today: data.today, doses: data.doses, moodDates });
  const slots: (MonthCell | null)[] = [...Array<null>(leading).fill(null), ...cells];
  while (slots.length % 7) slots.push(null);
  const weeks = Array.from({ length: slots.length / 7 }, (_, i) => slots.slice(i * 7, i * 7 + 7));

  const title = span === 'month' ? monthTitle(month, data.today) : `Last ${span} days`;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {span === 'month' ? (
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
        ) : null}
      </View>
      <AppText variant="caption" tone="secondary">
        Steady {steadyScore(data.doses, data.today)} · {totalDaysMarked(data.doses)} days marked
      </AppText>

      <Segmented label="Calendar range" options={SPANS} value={span} onChange={setSpan} />

      {span === 'month' ? (
        <View {...pan.panHandlers}>
          <View style={styles.row}>
            {WEEK_LETTERS.map((l, i) => (
              <AppText key={i} variant="label" tone="secondary" style={styles.letter} importantForAccessibility="no">
                {l}
              </AppText>
            ))}
          </View>
          {weeks.map((week, w) => (
            <View key={w} style={[styles.row, week.some((c) => c?.thisWeek) && { backgroundColor: theme.glass.overlay, borderRadius: 14 }]}>
              {week.map((c, i) =>
                c ? (
                  <Pressable
                    key={c.date}
                    accessibilityRole="button"
                    accessibilityLabel={[shortDate(c.date), c.isToday ? 'today' : '', RING_WORDS[c.ring]].filter(Boolean).join(', ')}
                    accessibilityHint="Shows that day"
                    onPress={() => onOpenDay(entryFor(c, data.today))}
                    style={styles.cell}
                  >
                    <View style={[styles.num, c.isToday && { backgroundColor: theme.text.primary }]}>
                      <AppText style={[styles.numText, c.isToday && { color: theme.background[0], fontWeight: '600' }]}>{c.day}</AppText>
                    </View>
                    <Ring ring={c.ring} />
                  </Pressable>
                ) : (
                  <View key={`blank-${i}`} style={styles.cell} />
                ),
              )}
            </View>
          ))}
          <View style={styles.legend}>
            {(['full', 'half', 'hollow', 'dot'] as const).map((r) => (
              <View key={r} style={styles.legendItem}>
                <Ring ring={r} size={10} />
                <AppText variant="caption" tone="secondary">
                  {r === 'full' ? 'all' : r === 'half' ? 'some' : RING_WORDS[r]}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" tone="secondary" style={styles.legendEnd}>
              shaded row = this week
            </AppText>
          </View>
        </View>
      ) : (
        <Density data={data} span={Number(span)} />
      )}
    </View>
  );
}

function Density({ data, span }: { data: HistoryData; span: number }) {
  const theme = useTheme();
  const cells = densityCells({ doses: data.doses, today: data.today, span });
  const fills = ['rgba(127, 120, 110, 0.12)', `${theme.accent}80`, theme.accent, theme.accentDeep];
  const full = cells.filter((c) => c.level === 3).length;
  const some = cells.filter((c) => c.level === 1 || c.level === 2).length;
  const rest = cells.filter((c) => c.rest).length;
  const rows = Array.from({ length: Math.ceil(cells.length / 10) }, (_, i) => cells.slice(i * 10, i * 10 + 10));

  return (
    <View style={styles.density} accessible accessibilityLabel={`Last ${span} days: ${full} fully marked, ${some} partly marked, ${rest} rest days.`}>
      {rows.map((row, r) => (
        <View key={r} style={styles.densityRow}>
          {Array.from({ length: 10 }, (_, i) => {
            const c = row[i];
            if (!c) return <View key={i} style={styles.square} />;
            return (
              <View
                key={c.date}
                style={[
                  styles.square,
                  c.level === null
                    ? { borderWidth: 1, borderColor: 'rgba(127, 120, 110, 0.18)' }
                    : { backgroundColor: fills[c.level], ...(c.rest ? { borderWidth: 2, borderColor: theme.text.secondary } : null) },
                  c.date === data.today && { borderWidth: 2, borderColor: theme.accentLine },
                ]}
              />
            );
          })}
        </View>
      ))}
      <AppText variant="caption" tone="secondary">
        Deeper beige means more of that day was marked. Outlined squares are rest days.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arrows: { flexDirection: 'row', gap: 6 },
  arrow: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  letter: { flex: 1, textAlign: 'center', paddingBottom: 4 },
  cell: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  num: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 14, lineHeight: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendEnd: { marginLeft: 'auto' },
  density: { gap: 6 },
  densityRow: { flexDirection: 'row', gap: 6 },
  square: { flex: 1, aspectRatio: 1, borderRadius: 7 },
});
