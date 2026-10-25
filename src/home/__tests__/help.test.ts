import type { DoseStatus } from '../../db/schema';
import { shouldOfferHelp } from '../help';

const NOW = '2026-10-25T10:00:00.000Z';
const dose = (minutesAgo: number, status: DoseStatus = 'pending') => ({ dueAtUtc: new Date(Date.parse(NOW) - minutesAgo * 60_000).toISOString(), status });

describe('shouldOfferHelp', () => {
  it('never offers at Light', () => {
    expect(shouldOfferHelp({ level: 'light', doses: [dose(600)], now: NOW, offeredToday: false })).toBe(false);
  });

  it('offers at Steady once a dose is an hour overdue', () => {
    expect(shouldOfferHelp({ level: 'steady', doses: [dose(59)], now: NOW, offeredToday: false })).toBe(false);
    expect(shouldOfferHelp({ level: 'steady', doses: [dose(60)], now: NOW, offeredToday: false })).toBe(true);
  });

  it('offers sooner at Close, after 30 minutes', () => {
    expect(shouldOfferHelp({ level: 'close', doses: [dose(30)], now: NOW, offeredToday: false })).toBe(true);
  });

  it('only counts doses still open', () => {
    expect(shouldOfferHelp({ level: 'close', doses: [dose(90, 'taken_late'), dose(90, 'excused')], now: NOW, offeredToday: false })).toBe(false);
  });

  it('offers at most once a day', () => {
    expect(shouldOfferHelp({ level: 'close', doses: [dose(90)], now: NOW, offeredToday: true })).toBe(false);
  });
});
