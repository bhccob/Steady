import { Linking } from 'react-native';

import type { GuardianChannel } from '../db/schema';

const digits = (s: string) => s.replace(/[^\d+]/g, '');

export function callUrl(phone: string): string {
  return `tel:${digits(phone)}`;
}

/** Opens the user's own messaging app. WeChat can't target a chat, so it just opens WeChat. */
export function messageUrl(channel: GuardianChannel, contact: string): string | null {
  switch (channel) {
    case 'sms':
      return `sms:${digits(contact)}`;
    case 'whatsapp':
      return `whatsapp://send?phone=${digits(contact).replace('+', '')}`;
    case 'wechat':
      return 'weixin://';
    case 'instagram':
      return `instagram://user?username=${encodeURIComponent(contact.replace(/^@/, ''))}`;
    default:
      return null;
  }
}

export async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
