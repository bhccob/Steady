import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect } from 'react-native-svg';

import type { HistoryData } from '../calendar/useHistory';
import { shortDate } from '../lib/time';
import { totalPoints } from '../rewards/trophies';
import { totalDaysMarked } from '../scoring/streak';
import { DECOR_FONT_SCALE } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/Text';
import { breakdown, describeRange, markOffsets, moodMarks, scoreSeries, trophyShelf, usualRange, weekBars, type Breakdown, type WeekBar } from './stats';

const MOOD_ICON: Record<string, IconName> = { happy: 'smile', okay: 'meh', rough: 'frown' };

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

function Section({ title, caption, label, children }: { title: string; caption?: string; label?: string; children?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View accessible={!!label} accessibilityLabel={label ? `${title}. ${label}` : undefined}>
        <AppText variant="bodyStrong" accessibilityRole="header">
          {title}
        </AppText>
        {caption ? (
          <AppText variant="caption" tone="secondary">
            {caption}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Swatch({ color, hollow }: { color: string; hollow?: boolean }) {
  return <View style={[styles.swatch, hollow ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color }]} />;
}

/** How the last 30 days went: a donut (no more than five parts) with a legend that carries the counts. */
function Donut({ b }: { b: Breakdown }) {
  const t = useTheme();
  const parts = [
    { key: 'On time', n: b.ontime, color: t.chart.steps[0] },
    { key: 'A bit later', n: b.later, color: t.chart.steps[1] },
    { key: 'Partly marked', n: b.partial, color: t.chart.steps[2] },
    { key: 'Rest days', n: b.rest, color: t.text.secondary, hollow: true },
    { key: 'Not marked', n: b.notMarked, color: t.chart.none },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0);
  const size = 124;
  const c = size / 2;
  const r = 48;
  const C = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <View style={styles.donutRow}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${c} ${c})`}>
            {parts.map((p) => {
              const len = (C * p.n) / total;
              const el = (
                <Circle
                  key={p.key}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.hollow ? 3 : 16}
                  strokeDasharray={`${Math.max(len - gap, 0.5)} ${C - Math.max(len - gap, 0.5)}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <AppText variant="heading" maxFontSizeMultiplier={DECOR_FONT_SCALE}>
            {b.percentMarked}%
          </AppText>
          <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={DECOR_FONT_SCALE}>
            marked
          </AppText>
        </View>
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendRow}>
            <Swatch color={p.color} hollow={p.hollow} />
            <AppText variant="caption" style={styles.grow}>
              {p.key}
            </AppText>
            <AppText variant="caption" style={styles.count}>
              {p.n}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function barWords(b: WeekBar): string {
  if (b.state === 'ahead') return 'still to come';
  if (b.state === 'rest') return 'rest day';
  if (b.total === 0) return 'nothing due';
  const parts = [b.ontime ? `${b.ontime} on time` : '', b.later ? `${b.later} a bit later` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : b.state === 'today' ? 'nothing marked yet' : 'nothing marked';
}

/** This week, Monday to Sunday. Darker is on time, lighter is a bit later, outlined is a rest day. */
function WeekChart({ bars }: { bars: WeekBar[] }) {
  const t = useTheme();
  const todayIndex = Math.max(0, bars.findIndex((b) => b.state === 'today'));
  const [selected, setSelected] = useState(todayIndex);
  const plotH = 84;
  const unit = plotH / Math.max(1, ...bars.map((b) => b.total));
  const pick = bars[selected] ?? bars[todayIndex]!;

  return (
    <View>
      <View style={styles.bars}>
        {bars.map((b, i) => (
          <Pressable
            key={b.date}
            accessibilityRole="button"
            accessibilityLabel={`${shortDate(b.date)}: ${barWords(b)}`}
            onPress={() => setSelected(i)}
            style={[styles.barCol, i === selected && { backgroundColor: t.glass.overlay }]}
          >
            <View style={[styles.barPlot, { height: plotH }]}>
              {b.state === 'rest' ? (
                <View style={[styles.bar, { height: b.total * unit, borderWidth: 2, borderColor: t.text.secondary }]} />
              ) : (
                <>
                  {b.later ? <View style={[styles.bar, styles.barTop, { height: b.later * unit - 2, marginBottom: 2, backgroundColor: t.chart.steps[1] }]} /> : null}
                  {b.ontime ? (
                    <View style={[styles.bar, !b.later && styles.barTop, { height: b.ontime * unit, backgroundColor: t.chart.steps[0] }]} />
                  ) : null}
                </>
              )}
            </View>
            <View style={[styles.baseline, { backgroundColor: t.chart.grid }]} />
            <AppText variant="caption" tone={b.state === 'today' ? 'primary' : 'secondary'} style={b.state === 'today' && styles.bold}>
              {b.letter}
            </AppText>
          </Pressable>
        ))}
      </View>
      <View style={styles.legendInline}>
        <View style={styles.legendRow}>
          <Swatch color={t.chart.steps[0]} />
          <AppText variant="caption" tone="secondary">
            on time
          </AppText>
        </View>
        <View style={styles.legendRow}>
          <Swatch color={t.chart.steps[1]} />
          <AppText variant="caption" tone="secondary">
            a bit later
          </AppText>
        </View>
        <View style={styles.legendRow}>
          <Swatch color={t.text.secondary} hollow />
          <AppText variant="caption" tone="secondary">
            rest day
          </AppText>
        </View>
      </View>
      <AppText style={styles.readout} accessibilityLiveRegion="polite">
        {shortDate(pick.date)} · {barWords(pick)}
      </AppText>
    </View>
  );
}

/** Steady score over the last 14 days: one 2px line on a quiet wash, with the chosen day's value. */
function ScoreLine({ series }: { series: { date: string; score: number }[] }) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const [selected, setSelected] = useState(series.length - 1);
  const h = 110;
  const pad = 8;
  const scores = series.map((p) => p.score);
  const lowest = Math.min(...scores);
  const min = lowest >= 100 ? 90 : Math.max(0, Math.floor((lowest - 5) / 10) * 10);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (series.length - 1);
  const y = (s: number) => pad + (1 - (s - min) / (100 - min)) * (h - 2 * pad);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const pick = series[selected] ?? series[series.length - 1]!;
  const px = x(Math.min(selected, series.length - 1));
  const py = y(pick.score);

  return (
    <View>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => setSelected(Math.max(0, Math.min(series.length - 1, Math.round(((e.nativeEvent.locationX - pad) / (w - 2 * pad)) * (series.length - 1)))))}
        accessibilityRole="adjustable"
        accessibilityLabel="Steady score by day"
        accessibilityValue={{ text: `${shortDate(pick.date)}, Steady ${pick.score}` }}
        onAccessibilityAction={(e) =>
          setSelected((s) => Math.max(0, Math.min(series.length - 1, s + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        style={{ height: h }}
      >
        {w > 0 ? (
          <Svg width={w} height={h}>
            {[100, (100 + min) / 2, min].map((v) => (
              <Line key={v} x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} stroke={t.chart.grid} strokeWidth={1} />
            ))}
            <Line x1={px} x2={px} y1={pad} y2={h - pad} stroke={t.chart.grid} strokeWidth={1} />
            <Polygon points={`${x(0)},${h - pad} ${pts} ${x(series.length - 1)},${h - pad}`} fill={t.chart.steps[0]} fillOpacity={0.1} />
            <Polyline points={pts} fill="none" stroke={t.chart.steps[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={px} cy={py} r={5} fill={t.chart.steps[0]} stroke={t.background[0]} strokeWidth={2} />
          </Svg>
        ) : null}
        <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.tick, { top: y(100) - 16 }]}>
          100
        </AppText>
        <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.tick, { top: y(min) - 16 }]}>
          {min}
        </AppText>
      </Pressable>
      <View style={styles.axisRow}>
        <AppText variant="caption" tone="secondary">
          {shortDate(series[0]!.date).slice(4)}
        </AppText>
        <AppText variant="caption" tone="secondary">
          today
        </AppText>
      </View>
      <AppText style={styles.readout} accessibilityLiveRegion="polite">
        {shortDate(pick.date)} · Steady {pick.score}
      </AppText>
    </View>
  );
}

const RHYTHM_MIN = -30;
const RHYTHM_MAX = 120;
const RHYTHM_TICKS: [number, string][] = [
  [-30, '−30'],
  [0, 'set time'],
  [30, '+30'],
  [60, '+1h'],
  [120, '+2h'],
];

/** When doses get marked, relative to their set time, with the usual range shaded. */
function Rhythm({ offsets, range }: { offsets: number[]; range: { from: number; to: number } | null }) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const h = 56;
  const pad = 10;
  const x = (m: number) => pad + ((Math.max(RHYTHM_MIN, Math.min(RHYTHM_MAX, m)) - RHYTHM_MIN) / (RHYTHM_MAX - RHYTHM_MIN)) * (w - 2 * pad);

  return (
    <View onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          {range ? <Rect x={x(range.from) - 4} y={6} width={Math.max(x(range.to) - x(range.from) + 8, 10)} height={40} rx={8} fill={t.accent} fillOpacity={0.6} /> : null}
          <Line x1={pad} x2={w - pad} y1={h - 4} y2={h - 4} stroke={t.chart.grid} strokeWidth={1} />
          {offsets.map((m, i) => (
            <Circle key={i} cx={x(m)} cy={16 + (i % 3) * 10} r={4} fill={t.chart.steps[0]} stroke={t.background[0]} strokeWidth={2} />
          ))}
        </Svg>
      ) : null}
      <View style={[styles.rhythmTicks, { width: w }]}>
        {w > 0
          ? RHYTHM_TICKS.map(([m, label]) => (
              <AppText key={m} variant="caption" tone="secondary" maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.rhythmTick, { left: x(m) - 32 }]}>
                {label}
              </AppText>
            ))
          : null}
      </View>
    </View>
  );
}

/** Mood above, marks below, for each of the last 14 days. */
function MoodMarks({ days }: { days: ReturnType<typeof moodMarks> }) {
  const t = useTheme();
  return (
    <View style={styles.moodRow}>
      {days.map((d) => (
        <View key={d.date} style={styles.moodCol}>
          {d.mood ? <Icon name={MOOD_ICON[d.mood]!} size={16} color={t.text.secondary} /> : <View style={[styles.noMood, { backgroundColor: t.chart.grid }]} />}
          <View
            style={[
              styles.markBar,
              d.taken ? { height: 4 + Math.min(d.taken, 4) * 8, backgroundColor: t.chart.steps[1] } : { height: 4, borderWidth: 1, borderColor: t.chart.grid },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/** Patterns from the user's own history, for them only. */
export function InsightsView({ data }: { data: HistoryData }) {
  const t = useTheme();
  const { doses, today } = data;
  const b = breakdown(doses, today, 30);
  const bars = weekBars(doses, today);
  const series = scoreSeries(doses, today, 14);
  const offsets = markOffsets(doses, today, 30);
  const range = usualRange(offsets);
  const mm = moodMarks(doses, data.checkins, today, 14);
  const collected = new Set(data.trophies.map((x) => x.weekStart));
  const shelf = trophyShelf({ firstDay: data.firstDay, today, nowMinutes: data.nowMinutes, collected });
  const points = totalPoints({ markedDays: totalDaysMarked(doses), trophiesCollected: data.trophies.length });
  const moodsLogged = mm.filter((d) => d.mood).length;

  return (
    <View style={styles.wrap}>
      <View>
        <AppText variant="title" accessibilityRole="header">
          Insights
        </AppText>
        <AppText variant="caption" tone="secondary">
          Your own patterns, for you. Never shared.
        </AppText>
      </View>

      <Section
        title="Last 30 days"
        caption={b.percentMarked === null ? 'This fills in once your first doses have been due.' : 'How each day went'}
        label={
          b.percentMarked === null
            ? undefined
            : `${b.percentMarked}% of days marked. ${b.ontime} on time, ${b.later} a bit later, ${b.partial} partly marked, ${b.rest} rest days, ${b.notMarked} not marked.`
        }
      >
        {b.percentMarked === null ? null : <Donut b={b} />}
      </Section>

      <Section title="This week" caption="Tap a day to see it.">
        <WeekChart bars={bars} />
      </Section>

      <Section
        title="Steady score"
        caption={series.length >= 2 ? 'Last 14 days' : 'Your score line starts after a couple of days.'}
        label={series.length >= 2 ? `From ${series[0]!.score} to ${series[series.length - 1]!.score}.` : undefined}
      >
        {series.length >= 2 ? <ScoreLine series={series} /> : null}
      </Section>

      <Section
        title="Your rhythm"
        caption={range ? describeRange(range) : 'A few more marks and your rhythm shows here.'}
        label={range ? `${describeRange(range)} Based on ${offsets.length} marks in the last 30 days.` : undefined}
      >
        {offsets.length ? <Rhythm offsets={offsets} range={range} /> : null}
      </Section>

      <Section
        title="Mood and marks"
        caption="Last 14 days. Taller bars, more marked."
        label={`${moodsLogged} moods logged in the last 14 days. ${mm.map((d) => `${shortDate(d.date)}: ${d.mood ?? 'no mood'}, ${d.taken} marked`).join('. ')}.`}
      >
        <MoodMarks days={mm} />
      </Section>

      <Section
        title="Trophies"
        caption={`${data.trophies.length} collected · ${points} points. Points never go down.`}
        label={`${data.trophies.length} trophies collected, ${points} points.`}
      >
        <View style={styles.shelf}>
          {shelf.map((s) => (
            <View
              key={s.weekStart}
              style={[
                styles.trophy,
                s.state === 'got'
                  ? { backgroundColor: t.accent, borderBottomWidth: 3, borderBottomColor: t.accentDeep }
                  : { borderWidth: s.state === 'ready' ? 2 : 1.5, borderColor: s.state === 'ready' ? t.accentLine : t.chart.grid },
              ]}
            >
              <Icon name="award" size={16} color={s.state === 'got' ? t.onAccent : s.state === 'ready' ? t.text.primary : t.text.secondary} />
            </View>
          ))}
        </View>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 26 },
  section: { gap: 12 },
  grow: { flex: 1 },
  bold: { fontWeight: '600' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  donutCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  count: { fontWeight: '600' },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  bars: { flexDirection: 'row' },
  barCol: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 4, borderRadius: 12 },
  barPlot: { justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 22 },
  barTop: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { alignSelf: 'stretch', height: 1, marginTop: -6 },
  readout: { marginTop: 8 },
  tick: { position: 'absolute', right: 8, fontSize: 11 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  rhythmTicks: { height: 22 },
  rhythmTick: { position: 'absolute', width: 64, textAlign: 'center', fontSize: 11 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, minHeight: 64 },
  noMood: { width: 6, height: 6, borderRadius: 999, marginVertical: 5 },
  markBar: { width: 10, borderRadius: 3 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trophy: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
