import { forgetRemindersWith } from '../forget';
import { memoryKv } from '../kv';

it('deletes the server record and leaves nothing on the phone', async () => {
  const kv = memoryKv();
  await kv.set('identity', { id: 'i', secret: 's' });
  await kv.set('rem:x', { body: 'still here.' });
  await kv.set('pending', true);
  const calls: string[] = [];
  const api = { putInstall: async () => {}, putReminders: async () => {}, deleteInstall: async () => void calls.push('deleteInstall') };
  await forgetRemindersWith({ kv, api });
  expect(calls).toEqual(['deleteInstall']);
  expect(await kv.keys('')).toEqual([]);
});

it('still clears the phone when the server is out of reach', async () => {
  const kv = memoryKv();
  await kv.set('identity', { id: 'i', secret: 's' });
  await kv.set('rem:x', {});
  const api = { putInstall: async () => {}, putReminders: async () => {}, deleteInstall: async () => Promise.reject(new Error('offline')) };
  await forgetRemindersWith({ kv, api });
  expect(await kv.keys('')).toEqual([]);
});
