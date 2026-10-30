import { memoryKv, type Kv } from '../kv';
import { refreshRegistrationWith, reregisterWith, turnOnRemindersWith, withTimeout, type PushBrowser } from '../turnOn';

const KEY = 'B'.repeat(87);

const sub = (endpoint: string) => ({ endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => true });

function fakeBrowser({ permission = 'granted' as NotificationPermission, subscribed = null as string | null, subscribeFails = false, worker = true } = {}): PushBrowser {
  let current = subscribed ? sub(subscribed) : null;
  return {
    support: () => 'ok',
    permission: () => permission,
    requestPermission: async () => permission,
    pushManager: async () =>
      worker
        ? {
            getSubscription: async () => current,
            subscribe: async () => {
              if (subscribeFails) throw new Error('NotAllowedError');
              current = sub('https://push.example/new');
              return current;
            },
          }
        : null,
  };
}

function fakeApi(putInstallFails = false) {
  const installs: string[] = [];
  return {
    installs,
    putInstall: async (_me: unknown, subscription: PushSubscriptionJSON) => {
      if (putInstallFails) throw new Error('offline');
      installs.push(subscription.endpoint!);
    },
    putReminders: async () => {},
    deleteInstall: async () => {},
  };
}

let kv: Kv;
beforeEach(() => {
  kv = memoryKv();
});

describe('turning reminders on', () => {
  it('subscribes, registers this phone and sends its list', async () => {
    const api = fakeApi();
    const flush = jest.fn(async () => {});
    expect(await turnOnRemindersWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser(), flush })).toBe('on');
    expect(api.installs).toEqual(['https://push.example/new']);
    expect(await kv.get('registered')).toBe(true);
    expect(await kv.get('endpoint')).toBe('https://push.example/new');
    expect(flush).toHaveBeenCalled();
  });

  it("gives up instead of waiting for ever when the service worker didn't start", async () => {
    const api = fakeApi();
    expect(await turnOnRemindersWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ worker: false }), flush: async () => {} })).toBe('unsupported');
    expect(await kv.get('registered')).toBeUndefined();
  });

  it('says so when notifications are blocked', async () => {
    expect(await turnOnRemindersWith({ kv, api: fakeApi(), vapidPublicKey: KEY, browser: fakeBrowser({ permission: 'denied' }), flush: async () => {} })).toBe('denied');
  });
});

describe('registering again, after the server forgot this phone', () => {
  it('uses the push address it already has', async () => {
    const api = fakeApi();
    expect(await reregisterWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ subscribed: 'https://push.example/1' }) })).toBe('ok');
    expect(api.installs).toEqual(['https://push.example/1']);
    expect(await kv.get('endpoint')).toBe('https://push.example/1');
  });

  it('subscribes again when the old address is gone', async () => {
    const api = fakeApi();
    expect(await reregisterWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser() })).toBe('ok');
    expect(api.installs).toEqual(['https://push.example/new']);
  });

  it('is impossible once notifications are switched off', async () => {
    const api = fakeApi();
    expect(await reregisterWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ permission: 'denied', subscribed: 'https://push.example/1' }) })).toBe('impossible');
    expect(api.installs).toEqual([]);
  });

  it('is impossible when the browser wants a tap before it subscribes (iPhone)', async () => {
    expect(await reregisterWith({ kv, api: fakeApi(), vapidPublicKey: KEY, browser: fakeBrowser({ subscribeFails: true }) })).toBe('impossible');
  });

  it('fails for now when the server is out of reach, or the service worker is not running', async () => {
    expect(await reregisterWith({ kv, api: fakeApi(true), vapidPublicKey: KEY, browser: fakeBrowser({ subscribed: 'https://push.example/1' }) })).toBe('failed');
    expect(await reregisterWith({ kv, api: fakeApi(), vapidPublicKey: KEY, browser: fakeBrowser({ worker: false }) })).toBe('failed');
  });
});

describe('checking the registration when Steady opens', () => {
  beforeEach(async () => {
    await kv.set('registered', true);
    await kv.set('endpoint', 'https://push.example/1');
  });

  it('leaves an unchanged push address alone', async () => {
    const api = fakeApi();
    await refreshRegistrationWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ subscribed: 'https://push.example/1' }) });
    expect(api.installs).toEqual([]);
  });

  it('sends a push address that changed', async () => {
    const api = fakeApi();
    await refreshRegistrationWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ subscribed: 'https://push.example/2' }) });
    expect(api.installs).toEqual(['https://push.example/2']);
    expect(await kv.get('endpoint')).toBe('https://push.example/2');
  });

  it("turns reminders off when the address is gone and can't be renewed, so Settings shows Off", async () => {
    await refreshRegistrationWith({ kv, api: fakeApi(), vapidPublicKey: KEY, browser: fakeBrowser({ subscribeFails: true }) });
    expect(await kv.get('registered')).toBeUndefined();
  });

  it('does nothing while reminders are off', async () => {
    await kv.del('registered');
    const api = fakeApi();
    await refreshRegistrationWith({ kv, api, vapidPublicKey: KEY, browser: fakeBrowser({ subscribed: 'https://push.example/2' }) });
    expect(api.installs).toEqual([]);
  });
});

it('withTimeout gives null for something that never finishes', async () => {
  expect(await withTimeout(new Promise(() => {}), 10)).toBeNull();
  expect(await withTimeout(Promise.resolve('ready'), 10)).toBe('ready');
});
