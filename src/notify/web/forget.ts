import type { ReminderApi } from './api';
import type { Identity } from './identity';
import type { Kv } from './kv';

/** Part of "Delete everything" on the web: the server's record goes, and so does everything kept here. */
export async function forgetRemindersWith({ kv, api }: { kv: Kv; api: ReminderApi }): Promise<void> {
  const me = await kv.get<Identity>('identity');
  if (me) await api.deleteInstall(me).catch(() => {}); // Out of reach: the server forgets it after 30 quiet days.
  for (const key of await kv.keys('')) await kv.del(key);
}
