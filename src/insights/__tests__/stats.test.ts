import type { DoseStatus } from '../../db/schema';
import { breakdown, describeRange, markOffsets, moodMarks, scoreSeries, trophyShelf, usualRange, weekBars, type HistoryDose } from '../stats';

const TODAY = '2026-10-25'; // a Sunday

function dose(date: string, status: DoseStatus, opts: { hour?: number; takenAfterMin?: number } = {}): HistoryDose {
  const due = `${date}T${String(opts.hour ?? 8).padStart(2, '0')}:00:00.000Z`;
  const taken = status === 'taken_ontime' || status === 'taken_late';
  return {
    dueLocalDate: date,
    dueAtUtc: due,
    status,
    takenAtUtc: taken ? new Date(Date.parse(due) + (opts.takenAfterMin ?? 5) * 60_000).toISOString() : null,
  };
}

describe('breakdown', () => {
  it('sorts the days of the window by how they went', () => {
    const doses = [
      dose('2026-10-19', 'taken_ontime'),
      dose('2026-10-20', 'taken_late'),
      dose('2026-10-21', 'taken_ontime'),
      dose('2026-10-21', 'missed', { hour: 20 }),
      dose('2026-10-22', 'missed'), // first full miss: a rest day
      dose('2026-10-23', 'missed'), // second within a week: not marked
      dose(TODAY, 'pending'), // still open: left out
    ];
    expect(breakdown(doses, TODAY, 30)).toEqual({ ontime: 1, later: 1, partial: 1, rest: 1, notMarked: 1, percentMarked: 60 });
  });

  it('has no percentage before anything has been due', () => {
    expect(breakdown([dose(TODAY, 'pending')], TODAY, 30).percentMarked).toBeNull();
  });

  it('only looks at the last N days', () => {
    expect(breakdown([dose('2026-09-01', 'taken_ontime')], TODAY, 30).ontime).toBe(0);
  });
});

describe('weekBars', () => {
  it('gives Monday to Sunday of this week with on-time and later counts', () => {
    const doses = [dose('2026-10-19', 'taken_ontime'), dose('2026-10-19', 'taken_late', { hour: 20 }), dose('2026-10-20', 'missed')];
    const bars = weekBars(doses, '2026-10-22');
    expect(bars.map((b) => b.letter)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(bars[0]).toMatchObject({ date: '2026-10-19', ontime: 1, later: 1, total: 2, state: 'past' });
    expect(bars[1]).toMatchObject({ state: 'rest' });
    expect(bars[2]).toMatchObject({ state: 'none' });
    expect(bars[3]).toMatchObject({ state: 'today' });
    expect(bars[4]).toMatchObject({ state: 'ahead' });
  });
});

describe('scoreSeries', () => {
  it('starts on the first day with doses and runs to today', () => {
    const doses = [dose('2026-10-23', 'taken_ontime'), dose('2026-10-24', 'taken_ontime'), dose(TODAY, 'taken_ontime')];
    const series = scoreSeries(doses, TODAY, 14);
    expect(series.map((p) => p.date)).toEqual(['2026-10-23', '2026-10-24', TODAY]);
    expect(series.every((p) => p.score >= 0 && p.score <= 100)).toBe(true);
  });

  it('keeps to the last N days', () => {
    const doses = Array.from({ length: 20 }, (_, i) => dose(`2026-10-${String(i + 1).padStart(2, '0')}`, 'taken_ontime'));
    expect(scoreSeries(doses, TODAY, 14)).toHaveLength(14);
  });

  it('is empty before any doses', () => {
    expect(scoreSeries([], TODAY, 14)).toEqual([]);
  });
});

describe('markOffsets and usualRange', () => {
  it('lists how many minutes after the set time each dose was marked', () => {
    const doses = [dose('2026-10-23', 'taken_ontime', { takenAfterMin: 12 }), dose('2026-10-24', 'taken_late', { takenAfterMin: 75 }), dose(TODAY, 'missed')];
    expect(markOffsets(doses, TODAY, 30)).toEqual([12, 75]);
  });

  it('needs at least three marks before calling anything usual', () => {
    expect(usualRange([5, 10])).toBeNull();
  });

  it('gives the middle half of marks, rounded to five minutes', () => {
    expect(usualRange([0, 3, 6, 9, 14, 18, 60, 90])).toEqual({ from: 5, to: 20 });
  });
});

describe('describeRange', () => {
  it.each([
    [{ from: 5, to: 20 }, 'Usually 5 to 20 minutes after the set time.'],
    [{ from: 0, to: 10 }, 'Usually within 10 minutes of the set time.'],
    [{ from: 15, to: 15 }, 'Usually about 15 minutes after the set time.'],
    [{ from: 0, to: 0 }, 'Usually right at the set time.'],
    [{ from: -10, to: 5 }, 'Usually between 10 minutes early and 5 minutes after.'],
  ])('%j reads "%s"', (range, text) => {
    expect(describeRange(range)).toBe(text);
  });
});

describe('moodMarks', () => {
  it('pairs each of the last N days with its mood and how many doses were marked', () => {
    const doses = [dose('2026-10-24', 'taken_ontime'), dose('2026-10-24', 'taken_late', { hour: 20 }), dose(TODAY, 'missed')];
    const checkins = [{ dateLocal: '2026-10-24', mood: 'happy' as const }];
    expect(moodMarks(doses, checkins, TODAY, 3)).toEqual([
      { date: '2026-10-23', mood: null, taken: 0 },
      { date: '2026-10-24', mood: 'happy', taken: 2 },
      { date: TODAY, mood: null, taken: 0 },
    ]);
  });
});

describe('trophyShelf', () => {
  it('has one trophy per week since the first, newest last', () => {
    const shelf = trophyShelf({ firstDay: '2026-10-07', today: TODAY, nowMinutes: 9 * 60, collected: new Set(['2026-10-05']) });
    expect(shelf).toEqual([
      { weekStart: '2026-10-05', state: 'got' },
      { weekStart: '2026-10-12', state: 'ready' },
      { weekStart: '2026-10-19', state: 'locked' },
    ]);
  });

  it('keeps only the most recent weeks', () => {
    expect(trophyShelf({ firstDay: '2026-01-05', today: TODAY, nowMinutes: 0, collected: new Set(), max: 8 })).toHaveLength(8);
  });
});
