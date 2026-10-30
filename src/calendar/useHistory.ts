import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { listCheckins, type Checkin } from '../db/dao/checkins';
import { listDosesBetween, type Dose } from '../db/dao/doses';
import { listMeds, type Med } from '../db/dao/meds';
import { getProfile, type Profile } from '../db/dao/profile';
import { listTrophies, type CollectedTrophy } from '../db/dao/trophies';
import { markDose, type MarkOutcome } from '../home/markDose';
import { celebrateHaptic, markHaptic } from '../lib/haptics';
import { addDays, type LocalDate } from '../lib/time';
import { localDateIn, localMinutesIn } from '../lib/tz';
import { activePort, syncSoon } from '../notify/port';
import { useApp } from '../state/app';

export interface HistoryData {
  profile: Profile;
  today: LocalDate;
  /** The user's first local day, from when the profile was made. */
  firstDay: LocalDate;
  nowMs: number;
  nowMinutes: number;
  doses: Dose[];
  meds: Map<string, Med>;
  checkins: Checkin[];
  trophies: CollectedTrophy[];
}

/** Everything Calendar and Insights show. Home keeps doses reconciled; this only reads. */
export function useHistory() {
  const db = useSQLiteContext();
  const [data, setData] = useState<HistoryData | null>(null);

  const load = useCallback(async () => {
    const profile = await getProfile(db);
    if (!profile) return;
    const now = new Date();
    const tz = profile.timezone;
    const today = localDateIn(now, tz);
    setData({
      profile,
      today,
      firstDay: localDateIn(new Date(profile.createdAt), tz),
      nowMs: now.getTime(),
      nowMinutes: localMinutesIn(now, tz),
      doses: await listDosesBetween(db, '0000-01-01', addDays(today, 21)),
      meds: new Map((await listMeds(db, { includeInactive: true })).map((m) => [m.id, m])),
      checkins: await listCheckins(db),
      trophies: await listTrophies(db),
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && load()), [load]);

  const mark = useCallback(
    async (doseId: string): Promise<MarkOutcome | null> => {
      const outcome = await markDose(db, { doseId, nowUtc: new Date().toISOString() });
      if (outcome?.comeback) celebrateHaptic();
      else if (outcome) markHaptic();
      activePort.dismiss([doseId]).catch(() => {});
      syncSoon(db);
      await load();
      return outcome;
    },
    [db, load],
  );

  return { data, mark };
}
