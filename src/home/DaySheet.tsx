import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getCheckin } from '../db/dao/checkins';
import type { Dose } from '../db/dao/doses';
import type { Med } from '../db/dao/meds';
import { shortDate } from '../lib/time';
import { steadyScore } from '../scoring/score';
import { classifyMark } from '../scoring/status';
import { DECOR_FONT_SCALE, HAIRLINE } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/Text';
import type { PathEntry } from './path';

interface DaySheetProps {
  entry: PathEntry | null;
  justCollected: boolean;
  doses: Dose[];
  meds: Map<string, Med>;
  today: string;
  nowMs: number;
  clock: (iso: string) => string;
  onMark: (doseId: string) => void;
  onClose: () => void;
}

/** What happened on a day, or what a week's trophy holds. Opened by tapping the streak path. */
export function DaySheet({ entry, justCollected, doses, meds, today, nowMs, clock, onMark, onClose }: DaySheetProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const date = entry?.kind === 'day' ? entry.date : null;
  // Kept with the day it belongs to, so a sheet never shows the previous day's mood.
  const [loaded, setLoaded] = useState<{ date: string; mood: string | null } | null>(null);
  const mood = loaded && loaded.date === date ? loaded.mood : null;

  useEffect(() => {
    if (!date) return;
    let current = true;
    getCheckin(db, date).then((c) => current && setLoaded({ date, mood: c?.mood ?? null }));
    return () => {
      current = false;
    };
  }, [db, date]);

  if (!entry) return null;

  if (entry.kind === 'trophy') {
    const got = entry.state === 'got';
    return (
      <BottomSheet visible onClose={onClose} title={`Week trophy · ${entry.label}`}>
        {got ? (
          <View style={styles.trophy}>
            <View style={[styles.medal, { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep }]}>
              <AppText variant="heading" maxFontSizeMultiplier={DECOR_FONT_SCALE} style={{ color: theme.onAccent }}>
                +50
              </AppText>
            </View>
            <View style={styles.grow}>
              <AppText variant="heading">{justCollected ? '+50 points' : 'Collected'}</AppText>
              <AppText tone="secondary">{entry.daysMarked} of 7 days marked</AppText>
            </View>
          </View>
        ) : (
          <AppText>Ready on Sunday night, worth 50 points. Each day you mark adds 10 more.</AppText>
        )}
        <AppText variant="caption" tone="secondary" style={styles.note}>
          {got ? 'Every week ends with a trophy, however it went. Rest days never cost points.' : `${entry.daysMarked} days marked so far this week.`}
        </AppText>
      </BottomSheet>
    );
  }

  const dayDoses = doses.filter((d) => d.dueLocalDate === entry.date).sort((a, b) => (a.dueAtUtc < b.dueAtUtc ? -1 : 1));
  const nowIso = new Date(nowMs).toISOString();
  const title = `${entry.isToday ? 'Today, ' : ''}${shortDate(entry.date)}`;

  return (
    <BottomSheet visible onClose={onClose} title={title}>
      {dayDoses.length === 0 ? <AppText tone="secondary">Nothing was scheduled.</AppText> : null}
      {dayDoses.map((d) => {
        const label = meds.get(d.medId)?.label ?? 'my pill';
        const markable = d.status === 'pending' && classifyMark(d.dueAtUtc, nowIso) !== null && nowMs >= Date.parse(d.dueAtUtc) - 3_600_000;
        const status =
          d.status === 'taken_ontime' || d.status === 'taken_late'
            ? `marked ${clock(d.takenAtUtc!)}${d.backfilled ? ' · added later' : ''}`
            : d.status === 'excused'
              ? 'excused'
              : d.status === 'missed'
                ? 'not marked'
                : 'later';
        return (
          <View key={d.id} style={styles.row}>
            <AppText style={styles.grow}>
              {label} · {clock(d.dueAtUtc)}
            </AppText>
            {markable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mark ${label} as taken, due ${clock(d.dueAtUtc)}`}
                onPress={() => onMark(d.id)}
                style={[styles.mark, { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep }]}
              >
                <AppText variant="bodyStrong" style={{ color: theme.onAccent }}>
                  Mark
                </AppText>
              </Pressable>
            ) : (
              <AppText tone="secondary">{status}</AppText>
            )}
          </View>
        );
      })}
      {mood ? (
        <View style={styles.row}>
          <AppText style={styles.grow}>Mood</AppText>
          <AppText tone="secondary">{mood}</AppText>
        </View>
      ) : null}
      {entry.state === 'rest' ? (
        <AppText variant="caption" tone="secondary" style={styles.note}>
          We gave you a rest day. Your streak paused instead of breaking.
        </AppText>
      ) : null}
      {entry.date <= today && dayDoses.length ? <AppText style={styles.note}>Steady {steadyScore(doses, entry.date)} that day.</AppText> : null}
      <AppText variant="caption" tone="secondary" style={styles.note}>
        Marks can be added up to 24 hours after a dose.
      </AppText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
  mark: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 10 },
  trophy: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 8 },
  medal: { width: 60, height: 60, borderRadius: 999, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center' },
});
