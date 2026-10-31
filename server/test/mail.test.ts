import { afterEach, describe, expect, it, vi } from 'vitest';

import { mailerFor, resendMailer } from '../src/mail';

afterEach(() => vi.restoreAllMocks());

describe('mailerFor', () => {
  it('logs codes only when MAIL_MODE is log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await mailerFor({ MAIL_MODE: 'log', MAIL_FROM: 'Steady <sign-in@steadyapp.cc>' }).send('sam@example.com', 'Your Steady code: 123456', 'text')).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Your Steady code: 123456'));
  });

  it('fails to send when no Resend key is set, and never logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await mailerFor({ MAIL_FROM: 'Steady <sign-in@steadyapp.cc>' }).send('sam@example.com', 'Your Steady code: 123456', 'text')).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('sends through Resend with the key, from address and plain text', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await resendMailer('re_key', 'Steady <sign-in@steadyapp.cc>', f as unknown as typeof fetch).send('sam@example.com', 'S', 'T')).toBe(true);
    expect(f).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer re_key' }) }));
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ from: 'Steady <sign-in@steadyapp.cc>', to: 'sam@example.com', subject: 'S', text: 'T' });
  });
});
