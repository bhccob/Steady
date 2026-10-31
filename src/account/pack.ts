import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

import type { SteadyExport } from '../settings/data';

// A backup travels gzipped, made on the phone: the server then only has to encrypt it, which keeps
// years of history inside the free Workers plan's CPU limit per request. The `true` below is
// fflate's one-character-per-byte mode, which is what btoa and atob speak.

/** The backup as JSON, gzipped, as base64. */
export function packBackup(backup: SteadyExport): string {
  return btoa(strFromU8(gzipSync(strToU8(JSON.stringify(backup))), true));
}

/** Throws when the text is not a packed backup. */
export function unpackBackup(packed: string): SteadyExport {
  return JSON.parse(strFromU8(gunzipSync(strToU8(atob(packed), true)))) as SteadyExport;
}
