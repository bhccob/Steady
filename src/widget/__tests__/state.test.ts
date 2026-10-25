import type { DoseStatus } from '../../db/schema';
import { widgetState } from '../state';

const TODAY = '2026-10-25';
const at = (hm: string) => Date.parse(`${TODAY}T${hm}:00.000Z`);
const dose = (id: string, hm: string, status: DoseStatus = 'pending', date = TODAY) => ({ id, dueLocalDate: date, dueAtUtc: `${date}T${hm}:00.000Z`, status });

describe('widgetState', () => {
  it('shows the next time with a Taken button once it can be marked', () => {
    const s = widgetState({ doses: [dose('a', '08:00', 'taken_ontime'), dose('b', '20:00'), dose('c', '20:00')], today: TODAY, nowMs: at('19:30'), timezone: 'UTC' });
    expect(s.next).toEqual({ time: '20:00', doseIds: ['b', 'c'], markable: true });
    expect(s).toMatchObject({ markedToday: 1, dueToday: 3 });
  });

  it('shows the next time without a button until an hour before it', () => {
    const s = widgetState({ doses: [dose('b', '20:00')], today: TODAY, nowMs: at('12:00'), timezone: 'UTC' });
    expect(s.next).toEqual({ time: '20:00', doseIds: ['b'], markable: false });
  });

  it('has no next dose once everything today is marked', () => {
    const s = widgetState({ doses: [dose('a', '08:00', 'taken_ontime')], today: TODAY, nowMs: at('12:00'), timezone: 'UTC' });
    expect(s.next).toBeNull();
    expect(s).toMatchObject({ markedToday: 1, dueToday: 1 });
  });

  it('carries the streak, and never a med name', () => {
    const doses = [dose('y', '08:00', 'taken_ontime', '2026-10-24'), dose('a', '08:00', 'taken_ontime')];
    const s = widgetState({ doses, today: TODAY, nowMs: at('12:00'), timezone: 'UTC' });
    expect(s.streak).toBe(2);
    expect(JSON.stringify(s)).not.toMatch(/label|name/i);
  });
});
