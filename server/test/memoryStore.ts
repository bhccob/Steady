import type { DueReminder, Install, Reminder, Store } from '../src/types';

/** The Store in memory, for tests. `dump()` shows everything it holds. */
export function memoryStore(): Store & { dump(): unknown } {
  const installs = new Map<string, Install>();
  const reminders = new Map<string, Reminder[]>();
  const hits = new Map<string, number>();
  return {
    async getInstall(id) {
      return installs.get(id) ?? null;
    },
    async putInstall(install) {
      installs.set(install.id, { ...install });
    },
    async replaceReminders(installId, list) {
      reminders.set(installId, list.map((r) => ({ ...r })));
    },
    async deleteInstall(id) {
      installs.delete(id);
      reminders.delete(id);
    },
    async due(now, limit) {
      const out: DueReminder[] = [];
      for (const [installId, list] of reminders) for (const r of list) if (r.dueAt <= now) out.push({ ...r, installId });
      return out.sort((a, b) => a.dueAt - b.dueAt).slice(0, limit);
    },
    async deleteReminder(installId, rid) {
      reminders.set(installId, (reminders.get(installId) ?? []).filter((r) => r.rid !== rid));
    },
    async staleInstalls(before) {
      return [...installs.values()].filter((i) => i.touchedAt < before && !(reminders.get(i.id)?.length)).map((i) => i.id);
    },
    async countHit(key, windowStart) {
      const k = `${key}|${windowStart}`;
      const n = (hits.get(k) ?? 0) + 1;
      hits.set(k, n);
      return n;
    },
    dump() {
      return { installs: [...installs.values()], reminders: Object.fromEntries(reminders), hits: [...hits.keys()] };
    },
  };
}
