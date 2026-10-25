import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import type { Db } from '../db/types';
import { exportData } from './data';

const EXPORT_FILE = 'steady-export.json';

/** Writes everything to a JSON file and opens the share sheet so the user can save or send it. */
export async function shareExport(db: Db): Promise<void> {
  const file = new File(Paths.cache, EXPORT_FILE);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(await exportData(db, new Date().toISOString()), null, 2));
  await shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export my data', UTI: 'public.json' });
}

/** Part of "Delete everything": no export file is left behind. */
export function removeExportFiles(): void {
  const file = new File(Paths.cache, EXPORT_FILE);
  if (file.exists) file.delete();
}
