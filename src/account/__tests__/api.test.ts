import { AccountError, createAccountApi } from '../api';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: { status: number; body?: unknown }[]) {
  const calls: Call[] = [];
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 204 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  };
  return { f: f as unknown as typeof fetch, calls };
}

const body = (c: Call) => JSON.parse(String(c.init.body)) as unknown;

describe('account api', () => {
  it('asks for a code with the yes to the backup', async () => {
    const { f, calls } = fakeFetch([{ status: 204 }]);
    await createAccountApi('https://api.example', f).requestCode('sam@example.com');
    expect(calls[0]!.url).toBe('https://api.example/v1/account/code');
    expect(calls[0]!.init.method).toBe('POST');
    expect(body(calls[0]!)).toEqual({ email: 'sam@example.com', consent: true });
  });

  it('signs in with the email, code and device id', async () => {
    const answer = { token: 't'.repeat(43), isNew: false, hasBackup: true, savedAt: 1 };
    const { f, calls } = fakeFetch([{ status: 200, body: answer }]);
    expect(await createAccountApi('https://api.example', f).signIn('sam@example.com', '482931', 'd'.repeat(22))).toEqual(answer);
    expect(calls[0]!.url).toBe('https://api.example/v1/account/session');
    expect(body(calls[0]!)).toEqual({ email: 'sam@example.com', code: '482931', deviceId: 'd'.repeat(22) });
  });

  it('sends the session token on signed-in calls', async () => {
    const { f, calls } = fakeFetch([{ status: 200, body: { active: true, savedAt: null } }]);
    await createAccountApi('https://api.example', f).status('t'.repeat(43));
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${'t'.repeat(43)}`);
  });

  it('turns a refusal into an AccountError with its reason', async () => {
    const { f } = fakeFetch([{ status: 409, body: { reason: 'other-device' } }]);
    const backup = { app: 'Steady' as const, schemaVersion: 7, exportedAt: 'now', tables: {} as never };
    await expect(createAccountApi('https://api.example', f).putBackup('t'.repeat(43), backup)).rejects.toMatchObject({ status: 409, reason: 'other-device' });
    await expect(createAccountApi('https://api.example', fakeFetch([{ status: 500 }]).f).claim('t'.repeat(43))).rejects.toBeInstanceOf(AccountError);
  });

  it('sends a backup with its schema version, and reads none as null', async () => {
    const { f, calls } = fakeFetch([{ status: 204 }, { status: 404 }]);
    const api = createAccountApi('https://api.example', f);
    const backup = { app: 'Steady' as const, schemaVersion: 7, exportedAt: 'now', tables: {} as never };
    await api.putBackup('t'.repeat(43), backup);
    expect(body(calls[0]!)).toEqual({ schemaVersion: 7, data: backup });
    expect(await api.getBackup('t'.repeat(43))).toBeNull();
  });
});
