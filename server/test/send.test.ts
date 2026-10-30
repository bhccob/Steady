import { beforeEach, describe, expect, it } from 'vitest';

import { runDue } from '../src/send';
import type { PushSender, PushTarget } from '../src/types';
import { memoryStore } from './memoryStore';

const NOW = Date.parse('2026-11-01T08:00:00Z');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

let store: ReturnType<typeof memoryStore>;
let calls: { target: PushTarget; payload: string }[];

function sender(result: 'sent' | 'gone' | 'failed' = 'sent'): PushSender {
  return {
    async send(target, payload) {
      calls.push({ target, payload });
      return result;
    },
  };
}

async function install(id: string, touchedAt = NOW) {
  await store.putInstall({ id, secretHash: 'h', endpoint: `https://push.example/${id}`, p256dh: 'k', auth: 'a', touchedAt });
}

beforeEach(() => {
  store = memoryStore();
  calls = [];
});

describe('runDue', () => {
  it('sends what is due with only its id, then forgets it', async () => {
    await install('i1');
    await store.replaceReminders('i1', [
      { rid: 'due', dueAt: NOW, kind: 'dose' },
      { rid: 'later', dueAt: NOW + 5 * MIN, kind: 'dose' },
    ]);
    const result = await runDue({ store, sender: sender(), now: NOW });
    expect(calls.map((c) => c.payload)).toEqual(['{"id":"due"}']);
    expect(result.sent).toBe(1);
    expect((await store.due(NOW + 10 * MIN, 10)).map((r) => r.rid)).toEqual(['later']);
  });

  it('deletes an install whose push address is gone', async () => {
    await install('i1');
    await store.replaceReminders('i1', [{ rid: 'due', dueAt: NOW, kind: 'dose' }]);
    const result = await runDue({ store, sender: sender('gone'), now: NOW });
    expect(result.gone).toBe(1);
    expect(await store.getInstall('i1')).toBeNull();
  });

  it('retries a failed send for up to 10 minutes, then drops it', async () => {
    await install('i1');
    await store.replaceReminders('i1', [{ rid: 'due', dueAt: NOW, kind: 'dose' }]);
    await runDue({ store, sender: sender('failed'), now: NOW });
    expect((await store.due(NOW, 10)).length).toBe(1);
    const late = await runDue({ store, sender: sender('failed'), now: NOW + 11 * MIN });
    expect(late.dropped).toBe(1);
    expect((await store.due(NOW + 11 * MIN, 10)).length).toBe(0);
  });

  it('sends at most a batch per run', async () => {
    await install('i1');
    await store.replaceReminders('i1', Array.from({ length: 60 }, (_, i) => ({ rid: `r${i}`, dueAt: NOW - i, kind: 'dose' as const })));
    await runDue({ store, sender: sender(), now: NOW, batch: 50 });
    expect(calls.length).toBe(50);
  });

  it('clears installs with no reminders and no contact for 30 days', async () => {
    await install('old', NOW - 31 * DAY);
    await install('fresh', NOW - DAY);
    await runDue({ store, sender: sender(), now: NOW });
    expect(await store.getInstall('old')).toBeNull();
    expect(await store.getInstall('fresh')).not.toBeNull();
  });
});
