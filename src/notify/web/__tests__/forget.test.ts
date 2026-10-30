import { ServerError } from '../api';
import { forgetRemindersWith, retryForgetWith } from '../forget';
import { memoryKv } from '../kv';

const me = { id: 'i', secret: 's' };
const api = (deleteInstall: () => Promise<void>) => ({ putInstall: async () => {}, putReminders: async () => {}, deleteInstall });

it('deletes the server record, drops the push address and leaves nothing on the phone', async () => {
  const kv = memoryKv();
  await kv.set('identity', me);
  await kv.set('rem:x', { body: 'still here.' });
  await kv.set('changes', 3);
  const calls: string[] = [];
  await forgetRemindersWith({ kv, api: api(async () => void calls.push('deleteInstall')), unsubscribe: async () => void calls.push('unsubscribe') });
  expect(calls.sort()).toEqual(['deleteInstall', 'unsubscribe']);
  expect(await kv.keys('')).toEqual([]);
});

it('when the server is out of reach, keeps only the anonymous id, to delete its record next time', async () => {
  const kv = memoryKv();
  await kv.set('identity', me);
  await kv.set('rem:x', {});
  await forgetRemindersWith({ kv, api: api(() => Promise.reject(new Error('offline'))), unsubscribe: async () => {} });
  expect(await kv.keys('')).toEqual(['forget']);
  expect(await kv.get('forget')).toEqual(me);
});

it('still clears the phone when the push address cannot be dropped', async () => {
  const kv = memoryKv();
  await kv.set('identity', me);
  await forgetRemindersWith({ kv, api: api(async () => {}), unsubscribe: () => Promise.reject(new Error('no worker')) });
  expect(await kv.keys('')).toEqual([]);
});

describe('next time Steady opens', () => {
  it('deletes the record left behind, and then forgets the id', async () => {
    const kv = memoryKv();
    await kv.set('forget', me);
    const deleted: unknown[] = [];
    await retryForgetWith({ kv, api: api(async () => void deleted.push(me)) });
    expect(deleted).toEqual([me]);
    expect(await kv.get('forget')).toBeUndefined();
  });

  it('forgets the id when the server had already let it go', async () => {
    const kv = memoryKv();
    await kv.set('forget', me);
    await retryForgetWith({ kv, api: api(() => Promise.reject(new ServerError(401))) });
    expect(await kv.get('forget')).toBeUndefined();
  });

  it('keeps it while the server is still out of reach', async () => {
    const kv = memoryKv();
    await kv.set('forget', me);
    await retryForgetWith({ kv, api: api(() => Promise.reject(new Error('offline'))) });
    expect(await kv.get('forget')).toEqual(me);
  });
});
