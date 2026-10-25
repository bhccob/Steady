import { openDatabaseAsync } from 'expo-sqlite';

import { DB_NAME, migrate } from './migrations';
import type { Db } from './types';

/**
 * Opens Steady's database outside the React tree: the background notification task and the
 * home-screen widget run without the app's screens. The app itself uses SQLiteProvider.
 */
export async function openSteadyDb(): Promise<Db> {
  const db = await openDatabaseAsync(DB_NAME);
  await migrate(db);
  return db;
}
