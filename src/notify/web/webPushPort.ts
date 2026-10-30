import { WEB_COPY } from '../copy';
import type { Category, Planned } from '../plan';
import type { NotificationPort } from '../scheduler';
import type { ReminderApi, ServerReminder } from './api';
import { getIdentity } from './identity';
import { opaqueId } from './ids';
import type { Kv } from './kv';

// The web's reminder port. The planner and scheduler are the same as on Android; this keeps each
// reminder's words on the phone (IndexedDB, read by the service worker) under an opaque id, and
// sends the server only that id, the time and the kind (spec: "What the server may know").

type Kind = 'dose' | 'dose_final' | 'bedtime' | 'other' | 'keep';

/** What the phone keeps per reminder, at `rem:<opaque id>`. */
export interface LocalReminder {
  plannedId: string;
  body: string;
  fireAt: string;
  kind: Kind;
  doseIds: string[];
}

const SERVER_MAX = 60;
const KEEP_AFTER_MS = 60 * 60 * 1000;
const TOMB_MS = 24 * 60 * 60 * 1000;

const kindOf = (category: Category | null): Kind => category ?? 'other';

export interface WebPushPortDeps {
  kv: Kv;
  api: ReminderApi;
  /** Notification permission granted and a push subscription saved. */
  permitted: () => Promise<boolean>;
  /** The reminders showing now (service worker registration). */
  notifications?: () => Promise<{ data?: unknown; close(): void }[]>;
  now?: () => number;
}

export function createWebPushPort({ kv, api, permitted, notifications, now = Date.now }: WebPushPortDeps): NotificationPort & { flush(): Promise<void> } {
  const idFor = async (plannedId: string) => opaqueId((await getIdentity(kv)).secret, plannedId);

  const reminders = async () => {
    const out: { oid: string; rec: LocalReminder }[] = [];
    for (const key of await kv.keys('rem:')) {
      const rec = await kv.get<LocalReminder>(key);
      if (rec) out.push({ oid: key.slice(4), rec });
    }
    return out;
  };

  return {
    permitted,

    async scheduled() {
      return (await reminders()).filter(({ rec }) => rec.kind !== 'keep').map(({ rec }) => ({ id: rec.plannedId, fireAt: rec.fireAt, body: rec.body }));
    },

    async schedule(n: Planned) {
      const oid = await idFor(n.id);
      const rec: LocalReminder = { plannedId: n.id, body: n.body, fireAt: n.fireAt, kind: kindOf(n.category), doseIds: n.data.kind === 'dose' ? [...n.data.doseIds] : [] };
      await kv.set(`rem:${oid}`, rec);
      await kv.del(`tomb:${oid}`);
      await kv.set('pending', true);
    },

    async cancel(plannedId: string) {
      const oid = await idFor(plannedId);
      await kv.del(`rem:${oid}`);
      await kv.set(`tomb:${oid}`, { at: now() });
      await kv.set('pending', true);
    },

    async dismiss(doseIds: readonly string[]) {
      for (const shown of (await notifications?.()) ?? []) {
        const ids = (shown.data as { doseIds?: unknown } | undefined)?.doseIds;
        if (Array.isArray(ids) && ids.some((id) => doseIds.includes(id as string))) shown.close();
      }
    },

    /** Sends the server the whole upcoming list, if anything changed and reminders are turned on. */
    async flush() {
      if (!(await kv.get('pending')) || !(await kv.get('registered'))) return;
      for (const key of await kv.keys('tomb:')) {
        const tomb = await kv.get<{ at: number }>(key);
        if (!tomb || now() - tomb.at > TOMB_MS) await kv.del(key);
      }

      // Reminders run out a few days ahead, until Steady is opened again: one quiet notice an
      // hour after the last says so. It's rebuilt on every flush, so there's only ever one.
      const all = await reminders();
      for (const { oid, rec } of all) if (rec.kind === 'keep') await kv.del(`rem:${oid}`);
      const planned = all.filter(({ rec }) => rec.kind !== 'keep').sort((a, b) => a.rec.fireAt.localeCompare(b.rec.fireAt));
      // Leave room for the notice within the server's cap; the furthest one is planned again later.
      const kept = planned.slice(0, SERVER_MAX - 1);
      const list: ServerReminder[] = kept.map(({ oid, rec }) => ({ id: oid, dueAt: rec.fireAt, kind: rec.kind }));
      const last = kept.at(-1);
      if (last) {
        const fireAt = new Date(Date.parse(last.rec.fireAt) + KEEP_AFTER_MS).toISOString();
        const plannedId = `keep:${fireAt}`;
        const oid = await idFor(plannedId);
        await kv.set(`rem:${oid}`, { plannedId, body: WEB_COPY.keepComing, fireAt, kind: 'keep', doseIds: [] } satisfies LocalReminder);
        list.push({ id: oid, dueAt: fireAt, kind: 'keep' });
      }

      try {
        await api.putReminders(await getIdentity(kv), list);
      } catch {
        return; // Still pending: sent on the next sync, or when the connection comes back.
      }
      await kv.set('pending', false);
    },
  };
}
