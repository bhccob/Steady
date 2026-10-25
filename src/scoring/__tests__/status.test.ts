import { classifyMark } from '../status';

const DUE = '2026-10-24T08:00:00.000Z';

describe('classifyMark', () => {
  it.each([
    ['before due', '2026-10-24T07:50:00.000Z', { status: 'taken_ontime', backfilled: false }],
    ['30 minutes after due', '2026-10-24T08:30:00.000Z', { status: 'taken_ontime', backfilled: false }],
    ['31 minutes after due', '2026-10-24T08:31:00.000Z', { status: 'taken_late', backfilled: false }],
    ['at the 4h grace edge', '2026-10-24T12:00:00.000Z', { status: 'taken_late', backfilled: false }],
    ['just past grace', '2026-10-24T12:01:00.000Z', { status: 'taken_late', backfilled: true }],
    ['at the 24h edge', '2026-10-25T08:00:00.000Z', { status: 'taken_late', backfilled: true }],
  ])('a mark %s is %o', (_label, markedAt, want) => {
    expect(classifyMark(DUE, markedAt)).toEqual(want);
  });

  it('refuses a mark more than 24h after due, because the dose is locked', () => {
    expect(classifyMark(DUE, '2026-10-25T08:01:00.000Z')).toBeNull();
  });
});
