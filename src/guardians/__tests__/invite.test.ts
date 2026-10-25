import { inviteMessage, inviteUrl } from '../invite';

describe('inviteMessage', () => {
  it('asks gently, signs with the user name, and never mentions meds', () => {
    const text = inviteMessage('Alex', 'sam');
    expect(text).toBe(
      "Hi Alex, I'm using an app called Steady to keep my days steady. Could I reach out to you when things feel like too much? You'd only hear from me when I ask. – sam",
    );
    expect(text).not.toMatch(/\b(med|meds|medication|pill|dose)\b/i);
  });

  it('leaves the sign-off out without a name', () => {
    expect(inviteMessage('Alex', '  ')).not.toContain('–');
  });
});

describe('inviteUrl', () => {
  const msg = 'Hi & hello';

  it('opens WhatsApp to the number with the message ready', () => {
    expect(inviteUrl('whatsapp', '+31 6 1234 5678', msg, 'android')).toBe('whatsapp://send?phone=31612345678&text=Hi%20%26%20hello');
  });

  it('opens a text message with the body, using each platform\'s form', () => {
    expect(inviteUrl('sms', '+44 7700 900123', msg, 'android')).toBe('sms:+447700900123?body=Hi%20%26%20hello');
    expect(inviteUrl('sms', '+44 7700 900123', msg, 'ios')).toBe('sms:+447700900123&body=Hi%20%26%20hello');
  });

  it('has no direct link for WeChat, Instagram or the app, so the share sheet is used instead', () => {
    expect(inviteUrl('wechat', 'jo_w', msg, 'ios')).toBeNull();
    expect(inviteUrl('instagram', '@jo', msg, 'ios')).toBeNull();
    expect(inviteUrl('inapp', 'STDY-4K7Q', msg, 'ios')).toBeNull();
  });
});
