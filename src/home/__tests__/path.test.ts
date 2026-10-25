import { day } from '../../test-utils/doses';
import { buildPath, indexOfToday } from '../path';

const base = { today: '2026-10-24', firstDay: '2026-10-01', collected: new Set<string>(), nowMinutes: 9 * 60 };

describe('buildPath', () => {
  it('lays out last week, this week, a trophy after each Sunday, then three days ahead', () => {
    const path = buildPath({ ...base, doses: [] });
    expect(path).toHaveLength(19);
    expect(path[0]).toMatchObject({ kind: 'day', date: '2026-10-12', weekday: 'Mon' });
    expect(path[7]).toMatchObject({ kind: 'trophy', weekStart: '2026-10-12', label: '12–18 Oct', state: 'ready' });
    expect(path[15]).toMatchObject({ kind: 'trophy', weekStart: '2026-10-19', state: 'locked' });
    expect(path.slice(16).map((e) => (e.kind === 'day' ? [e.date, e.state] : null))).toEqual([
      ['2026-10-26', 'ahead'],
      ['2026-10-27', 'ahead'],
      ['2026-10-28', 'ahead'],
    ]);
    expect(indexOfToday(path)).toBe(13);
  });

  it('shows a collected trophy as got', () => {
    const path = buildPath({ ...base, doses: [], collected: new Set(['2026-10-12']) });
    expect(path[7]).toMatchObject({ kind: 'trophy', state: 'got' });
  });

  it('marks days by what happened, never as a failure', () => {
    const doses = [
      ...day('2026-10-20', 'missed'),
      ...day('2026-10-22', 'missed', 'taken_late'),
      ...day('2026-10-23', 'missed', 'missed'),
      ...day('2026-10-24', 'pending'),
    ];
    const states = Object.fromEntries(buildPath({ ...base, doses }).flatMap((e) => (e.kind === 'day' ? [[e.date, e.state]] : [])));
    expect(states['2026-10-20']).toBe('rest');
    expect(states['2026-10-22']).toBe('done');
    expect(states['2026-10-23']).toBe('past');
    expect(states['2026-10-24']).toBe('today');
    expect(states['2026-10-21']).toBe('past');
  });

  it('counts the days marked in each trophy week', () => {
    const doses = [...day('2026-10-19', 'taken_ontime'), ...day('2026-10-21', 'taken_late', 'missed'), ...day('2026-10-23', 'excused')];
    const trophy = buildPath({ ...base, doses })[15];
    expect(trophy).toMatchObject({ kind: 'trophy', daysMarked: 2 });
  });

  it('shows today as done once something is marked', () => {
    const path = buildPath({ ...base, doses: day('2026-10-24', 'taken_ontime', 'pending') });
    expect(path[13]).toMatchObject({ kind: 'day', state: 'done', isToday: true });
  });

  it('starts with this week for someone new', () => {
    const path = buildPath({ ...base, firstDay: '2026-10-22', doses: [] });
    expect(path).toHaveLength(11);
    expect(path[0]).toMatchObject({ kind: 'day', date: '2026-10-19' });
  });

  it('readies this week\'s trophy on Sunday night', () => {
    const path = buildPath({ ...base, today: '2026-10-25', nowMinutes: 21 * 60, doses: [] });
    expect(path[15]).toMatchObject({ kind: 'trophy', state: 'ready' });
  });
});
