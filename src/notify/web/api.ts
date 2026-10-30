import type { Identity } from './identity';

// Talks to Steady's reminder server (server/src/core.ts). Every call throws when the server
// doesn't answer 2xx, so callers can keep their change pending and try again.

export interface ServerReminder {
  id: string;
  dueAt: string;
  kind: string;
}

export interface ReminderApi {
  putInstall(me: Identity, subscription: PushSubscriptionJSON): Promise<void>;
  putReminders(me: Identity, list: ServerReminder[]): Promise<void>;
  deleteInstall(me: Identity): Promise<void>;
}

export function createApi(baseUrl: string, f: typeof fetch = fetch): ReminderApi {
  const call = async (method: string, path: string, me: Identity | null, body?: unknown) => {
    const res = await f(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(me ? { Authorization: `Bearer ${me.id}.${me.secret}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`reminder server: ${res.status}`);
  };
  return {
    putInstall: (me, subscription) => call('PUT', '/v1/install', null, { id: me.id, secret: me.secret, subscription }),
    putReminders: (me, list) => call('PUT', '/v1/install/reminders', me, { reminders: list }),
    deleteInstall: (me) => call('DELETE', '/v1/install', me),
  };
}
