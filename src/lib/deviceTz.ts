import { getCalendars } from 'expo-localization';

/** The phone's IANA time zone, e.g. Europe/Amsterdam. */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}
