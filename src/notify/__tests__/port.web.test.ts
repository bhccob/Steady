import { activePort, setupNotifications, syncSoon } from '../port.web';

it('does nothing on the web until web reminders exist', async () => {
  expect(await activePort.permitted()).toBe(false);
  expect(await activePort.scheduled()).toEqual([]);
  await expect(activePort.cancel('x')).resolves.toBeUndefined();
  await expect(setupNotifications()).resolves.toBeUndefined();
  expect(() => syncSoon({} as never)).not.toThrow();
});
