import type { GuardianChannel } from '../db/schema';

const digits = (s: string) => s.replace(/[^\d+]/g, '');

/** The invite the user sends from their own phone. Says nothing about meds or health. */
export function inviteMessage(guardianName: string, myName: string): string {
  const signOff = myName.trim() ? ` – ${myName.trim()}` : '';
  return `Hi ${guardianName.trim()}, I'm using an app called Steady to keep my days steady. Could I reach out to you when things feel like too much? You'd only hear from me when I ask.${signOff}`;
}

/**
 * A link that opens the channel with the invite ready to send, or null when the channel
 * can't take a prefilled message (WeChat, Instagram, the app): then use the share sheet.
 */
export function inviteUrl(channel: GuardianChannel, contact: string, message: string, platform: 'ios' | 'android'): string | null {
  const text = encodeURIComponent(message);
  switch (channel) {
    case 'whatsapp':
      return `whatsapp://send?phone=${digits(contact).replace('+', '')}&text=${text}`;
    case 'sms':
      return `sms:${digits(contact)}${platform === 'ios' ? '&' : '?'}body=${text}`;
    default:
      return null;
  }
}
