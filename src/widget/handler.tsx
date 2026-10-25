// Widget lifecycle: drawing it, and its Taken button. Required only by index.ts and refresh.ts,
// and only in an Android development or store build.
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';

import { listDosesBetween } from '../db/dao/doses';
import { getProfile } from '../db/dao/profile';
import { openSteadyDb } from '../db/open';
import type { Db } from '../db/types';
import { addDays } from '../lib/time';
import { localDateIn } from '../lib/tz';
import { ACTIONS, handleResponse } from '../notify/actions';
import { expoPort } from '../notify/expoPort';
import { widgetState, type WidgetState } from './state';
import { StreakWidget, WIDGET_PALETTES } from './StreakWidget';
import { WIDGET_NAME } from './refresh';

async function loadState(db: Db): Promise<WidgetState | null> {
  const profile = await getProfile(db);
  if (!profile) return null;
  const now = new Date();
  const today = localDateIn(now, profile.timezone);
  const doses = await listDosesBetween(db, '0000-01-01', addDays(today, 1));
  return widgetState({ doses, today, nowMs: now.getTime(), timezone: profile.timezone });
}

async function draw(db: Db) {
  const state = await loadState(db);
  return { light: <StreakWidget state={state} palette={WIDGET_PALETTES.light} />, dark: <StreakWidget state={state} palette={WIDGET_PALETTES.dark} /> };
}

/** Redraws every Steady widget on the home screen. */
export async function updateWidgets(db: Db): Promise<void> {
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => draw(db) });
}

registerWidgetTaskHandler(async ({ widgetAction, clickAction, clickActionData, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  const db = await openSteadyDb();
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'MARK') {
    // Same path as the notification's "Taken": marks, clears reminders, re-syncs the schedule.
    await handleResponse(db, expoPort, { actionIdentifier: ACTIONS.taken, data: { kind: 'dose', doseIds: clickActionData?.doseIds } }, new Date());
  }
  renderWidget(await draw(db));
});
