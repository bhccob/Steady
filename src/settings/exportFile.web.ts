import type { Db } from '../db/types';
import { exportData } from './data';

const EXPORT_FILE = 'steady-export.json';

/** On the web, the export downloads as a file instead of opening a share sheet. */
export async function shareExport(db: Db): Promise<void> {
  const json = JSON.stringify(await exportData(db, new Date().toISOString()), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILE;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nothing is written on the web, so nothing is left behind. */
export function removeExportFiles(): void {}
