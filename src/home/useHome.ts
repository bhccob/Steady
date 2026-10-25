import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getCheckin, upsertCheckin, type Checkin } from '../db/dao/checkins';
import { listDosesBetween, type Dose } from '../db/dao/doses';
import { hasEventForDate, latestEventTime, logEvent } from '../db/dao/events';
import { listMeds, type Med } from '../db/dao/meds';
import { getProfile, type Profile } from '../db/dao/profile';
import { collectTrophy, listTrophies, type CollectedTrophy } from '../db/dao/trophies';
import type { Mood } from '../db/schema';
import { reconcileDoses } from '../doses/reconcile';
import { addDays, type LocalDate } from '../lib/time';
import { localDateIn, localMinutesIn } from '../lib/tz';
import { expoPort, syncSoon } from '../notify/expoPort';
import { useApp } from '../state/app';
import { LEVEL_RULES } from '../support/level';
import { bedtimeCard, type BedtimeCard } from './bedtime';
import { shouldOfferHelp } from './help';
import { markDose, type MarkOutcome } from './markDose';

export interface HomeData {
  profile: Profile;
  today: LocalDate;
  nowMs: number;
  nowMinutes: number;
  doses: Dose[];
  meds: Map<string, Med>;
  checkinToday: Checkin | null;
  moodDismissed: boolean;
  trophies: CollectedTrophy[];
  bedtime: BedtimeCard;
  /** A dose has been open long enough for this support level to offer the help sheet. */
  helpDue: boolean;
}

/** Loads Home from the database and refreshes on focus and on return to the foreground (spec §3.5). */
export function useHome() {
  const db = useSQLiteContext();
  const setSupportLevel = useApp((s) => s.setSupportLevel);
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(async () => {
    const profile = await getProfile(db);
    if (!profile) return;
    const now = new Date();
    const tz = profile.timezone;
    await reconcileDoses(db, { now: now.toISOString(), timezone: tz, notBefore: profile.createdAt });
    syncSoon(db);
    const today = localDateIn(now, tz);
    const doses = await listDosesBetween(db, '0000-01-01', addDays(today, 21));
    const meds = new Map((await listMeds(db, { includeInactive: true })).map((m) => [m.id, m]));
    const checkinToday = await getCheckin(db, today);
    const moodDismissed = await hasEventForDate(db, 'mood_prompt_dismissed', today);
    const trophies = await listTrophies(db);
    const { bedtimeMin, wakeMin } = profile;
    const bedtime = bedtimeCard({
      now: now.toISOString(),
      timezone: tz,
      sleep: bedtimeMin !== null && wakeMin !== null ? { bedtimeMin, wakeMin } : null,
      goodnightAt: await latestEventTime(db, 'goodnight'),
      snoozedAt: await latestEventTime(db, 'bedtime_snoozed'),
    });
    const helpDue = shouldOfferHelp({
      level: profile.supportLevel,
      doses: doses.filter((d) => d.dueLocalDate === today),
      now: now.toISOString(),
      offeredToday: await hasEventForDate(db, 'help_offered', today),
    });
    setSupportLevel(profile.supportLevel);
    useApp.getState().setCrisisRegion(profile.crisisRegion);
    setData({ profile, today, nowMs: now.getTime(), nowMinutes: localMinutesIn(now, tz), doses, meds, checkinToday, moodDismissed, trophies, bedtime, helpDue });
  }, [db, setSupportLevel]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  // A notification button can change doses while Home is showing.
  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && load()), [load]);

  const mark = useCallback(
    async (doseId: string): Promise<MarkOutcome | null> => {
      const outcome = await markDose(db, { doseId, nowUtc: new Date().toISOString() });
      expoPort.dismiss([doseId]).catch(() => {});
      await load(); // re-syncs reminders, cancelling the rest for this dose
      return outcome;
    },
    [db, load],
  );

  /** Saves today's mood. Returns true when the reach-out sheet should be offered. */
  const pickMood = useCallback(
    async (mood: Mood): Promise<boolean> => {
      if (!data) return false;
      await upsertCheckin(db, data.today, mood);
      if (mood !== 'rough') return false;
      const rule = LEVEL_RULES[data.profile.supportLevel].helpOnRough;
      if (rule === 'right_away') return true;
      return (await getCheckin(db, addDays(data.today, -1)))?.mood === 'rough';
    },
    [db, data],
  );

  const dismissMood = useCallback(async () => {
    if (data) await logEvent(db, 'mood_prompt_dismissed', { date: data.today });
  }, [db, data]);

  const collect = useCallback(
    async (weekStart: LocalDate, daysMarked: number) => {
      await collectTrophy(db, weekStart, daysMarked);
      await load();
    },
    [db, load],
  );

  /** Goodnight: quiet until wake-up. Same as the notification button. */
  const goodnight = useCallback(async () => {
    await logEvent(db, 'goodnight', { at: new Date().toISOString() });
    syncSoon(db);
    await load();
  }, [db, load]);

  /** "15 more min": the card and the next nudge wait 15 minutes. */
  const moreTime = useCallback(async () => {
    await logEvent(db, 'bedtime_snoozed', { at: new Date().toISOString() });
    syncSoon(db);
    await load();
  }, [db, load]);

  /** The overdue help sheet was shown today; don't offer it again until tomorrow. */
  const noteHelpOffered = useCallback(async () => {
    if (data) await logEvent(db, 'help_offered', { date: data.today });
  }, [db, data]);

  return { data, reload: load, mark, pickMood, dismissMood, collect, goodnight, moreTime, noteHelpOffered };
}
