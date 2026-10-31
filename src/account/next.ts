export type AfterSignIn = 'setup' | 'restore' | 'choose' | 'claim';

/**
 * Where to go once the code is right. A backup onto an empty device restores; a backup and data
 * on this device asks which to keep; no backup either sets up (empty) or backs this device up.
 */
export function afterSignIn(r: { isNew: boolean; hasBackup: boolean }, deviceHasData: boolean): AfterSignIn {
  if (r.hasBackup) return deviceHasData ? 'choose' : 'restore';
  return deviceHasData ? 'claim' : 'setup';
}
