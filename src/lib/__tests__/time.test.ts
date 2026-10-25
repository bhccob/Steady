import { addDays, daysBetween, formatHm, parseHm, shortDate, stepMinutes, weekdayOf } from '../time';
import { localDateIn, localMinutesIn, zonedTimeToUtc } from '../tz';

describe('shortDate', () => {
  it('reads like "Sat 24 Oct"', () => {
    expect(shortDate('2026-10-24')).toBe('Sat 24 Oct');
    expect(shortDate('2026-11-02')).toBe('Mon 2 Nov');
  });
});

describe('weekdays and local clock', () => {
  it('gives the weekday of a local date, 0 = Sunday', () => {
    expect(weekdayOf('2026-10-24')).toBe(6);
    expect(weekdayOf('2026-10-25')).toBe(0);
    expect(weekdayOf('2026-10-26')).toBe(1);
  });

  it('gives minutes after local midnight for an instant', () => {
    expect(localMinutesIn(new Date('2026-10-24T19:30:00.000Z'), 'Europe/Amsterdam')).toBe(21 * 60 + 30);
    expect(localMinutesIn(new Date('2026-10-24T19:30:00.000Z'), 'America/New_York')).toBe(15 * 60 + 30);
  });
});

describe('clock minutes', () => {
  it('formats minutes after midnight as HH:mm', () => {
    expect(formatHm(0)).toBe('00:00');
    expect(formatHm(1380)).toBe('23:00');
    expect(formatHm(425)).toBe('07:05');
  });

  it('parses HH:mm back to minutes', () => {
    expect(parseHm('23:15')).toBe(1395);
    expect(parseHm('08:00')).toBe(480);
  });

  it('steps across midnight in both directions', () => {
    expect(stepMinutes(1425, 15)).toBe(0);
    expect(stepMinutes(0, -15)).toBe(1425);
    expect(stepMinutes(480, 15)).toBe(495);
  });
});

describe('local date math', () => {
  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-12-31', 14, '2027-01-14'],
  ])('%s + %i days is %s', (from, n, want) => {
    expect(addDays(from, n)).toBe(want);
  });

  it('counts whole days between two local dates', () => {
    expect(daysBetween('2026-10-20', '2026-10-24')).toBe(4);
    expect(daysBetween('2026-10-24', '2026-10-20')).toBe(-4);
  });

  it('is unaffected by a DST change between the dates', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('time zones', () => {
  it('gives the local calendar date for an instant', () => {
    const instant = new Date('2026-10-24T22:30:00.000Z');
    expect(localDateIn(instant, 'Europe/Amsterdam')).toBe('2026-10-25');
    expect(localDateIn(instant, 'America/New_York')).toBe('2026-10-24');
  });

  it.each([
    ['2026-10-24', '08:00', 'Europe/Amsterdam', '2026-10-24T06:00:00.000Z'],
    ['2026-10-26', '08:00', 'Europe/Amsterdam', '2026-10-26T07:00:00.000Z'],
    ['2026-10-24', '20:00', 'America/New_York', '2026-10-25T00:00:00.000Z'],
    ['2026-10-24', '08:00', 'Australia/Sydney', '2026-10-23T21:00:00.000Z'],
  ])('%s %s in %s is %s', (date, time, tz, want) => {
    expect(zonedTimeToUtc(date, time, tz)).toBe(want);
  });

  it('moves a time that does not exist (spring forward) to just after the gap', () => {
    // Amsterdam skips 02:00-03:00 on 2026-03-29; 02:30 becomes 03:30 CEST.
    expect(zonedTimeToUtc('2026-03-29', '02:30', 'Europe/Amsterdam')).toBe('2026-03-29T01:30:00.000Z');
  });
});
