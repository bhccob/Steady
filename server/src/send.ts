import type { PushSender, Store } from './types';

// Once a minute: send each reminder that's due, then forget it. A push address the push service
// says is gone deletes its install; a failed send is retried each minute for up to 10 minutes.

const RETRY_MS = 10 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export async function runDue({ store, sender, now, batch = 50 }: { store: Store; sender: PushSender; now: number; batch?: number }) {
  let sent = 0, gone = 0, dropped = 0;
  for (const r of await store.due(now, batch)) {
    const install = await store.getInstall(r.installId);
    if (!install) {
      await store.deleteReminder(r.installId, r.rid);
      continue;
    }
    const result = await sender.send(install, JSON.stringify({ id: r.rid }));
    if (result === 'sent') {
      sent++;
      await store.deleteReminder(r.installId, r.rid);
    } else if (result === 'gone') {
      gone++;
      await store.deleteInstall(r.installId);
    } else if (now - r.dueAt > RETRY_MS) {
      dropped++;
      await store.deleteReminder(r.installId, r.rid);
    }
  }
  for (const id of await store.staleInstalls(now - STALE_MS)) await store.deleteInstall(id);
  return { sent, gone, dropped };
}
