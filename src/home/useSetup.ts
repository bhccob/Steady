import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { listGuardians } from '../db/dao/guardians';
import { listMeds } from '../db/dao/meds';
import { getProfile, updateProfile } from '../db/dao/profile';
import { listConditions } from '../db/dao/support';
import { getPermissionsAsync, requestPermissionsAsync } from '../lib/notifications';
import { nowIso } from '../lib/time';
import { remindersOn, syncSoon, turnOnReminders } from '../notify/port';
import { turnOnProblem } from '../notify/turnOnProblem';
import { useApp } from '../state/app';
import { setupList, type SetupRow } from './setup';

const web = Platform.OS === 'web';

/** True when reminders can reach this device: the phone's permission, or the web's push registration. */
async function remindersReachHere(): Promise<boolean> {
  try {
    return web ? await remindersOn() : (await getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Home's Get set up list, read again on focus and whenever data changes. */
export function useSetup() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<SetupRow[] | null>(null);
  const [remindNote, setRemindNote] = useState('');

  const load = useCallback(async () => {
    const profile = await getProfile(db);
    if (!profile) return;
    setRows(
      setupList({
        hasPills: (await listMeds(db)).length > 0,
        remindersOn: await remindersReachHere(),
        conditionCount: (await listConditions(db)).length,
        levelChosen: profile.supportLevelChosen,
        bedtimeSet: profile.bedtimeMin !== null,
        guardianCount: (await listGuardians(db)).length,
        answered: profile.setupAnswered,
        hidden: profile.setupHiddenAt !== null,
      }),
    );
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && load()), [load]);

  /** Must run from a tap: browsers and phones only ask then. */
  const turnOn = async () => {
    setRemindNote('');
    if (web) {
      const result = await turnOnReminders().catch(() => 'unsupported' as const);
      if (result !== 'on') setRemindNote(turnOnProblem(result, true));
    } else {
      const { granted } = await requestPermissionsAsync().catch(() => ({ granted: false }));
      if (!granted) setRemindNote(turnOnProblem('denied', false));
    }
    syncSoon(db);
    await load();
  };

  const hide = async () => {
    await updateProfile(db, { setupHiddenAt: nowIso() });
    await load();
  };

  return { rows, remindNote, turnOn, hide };
}
