import { ServerError, type ReminderApi } from './api';
import type { Identity } from './identity';
import type { Kv } from './kv';

/**
 * Part of "Delete everything" on the web: the server's record goes, the browser drops this phone's
 * push address (so nothing more can arrive), and everything kept here goes too. If the server is
 * out of reach, only the anonymous id stays, to delete its record when Steady next opens.
 */
export async function forgetRemindersWith({ kv, api, unsubscribe }: { kv: Kv; api: ReminderApi; unsubscribe: () => Promise<void> }): Promise<void> {
  const ids = [await kv.get<Identity>('identity'), await kv.get<Identity>('forget')].filter((me): me is Identity => me !== undefined);
  await unsubscribe().catch(() => {});
  const left: Identity[] = [];
  for (const me of ids) if (!(await deleted(api, me))) left.push(me);
  for (const key of await kv.keys('')) await kv.del(key);
  if (left[0]) await kv.set('forget', left[0]);
}

/** When Steady opens: deletes a server record "Delete everything" couldn't reach. */
export async function retryForgetWith({ kv, api }: { kv: Kv; api: ReminderApi }): Promise<void> {
  const me = await kv.get<Identity>('forget');
  if (me && (await deleted(api, me))) await kv.del('forget');
}

/** Gone from the server: deleted now, or already (401: it no longer knows this id). */
const deleted = (api: ReminderApi, me: Identity) => api.deleteInstall(me).then(
  () => true,
  (e: unknown) => e instanceof ServerError && e.status === 401,
);
