import { addedNote, glowColour, solidColour } from '../note';

const clock = (iso: string) => iso.slice(11, 16);
const NOW = '2026-10-30T15:00:00.000Z'; // a Friday

describe('addedNote', () => {
  it('says when the first reminder comes today', () => {
    expect(addedNote({ name: 'Vitamin D', firstDueUtc: '2026-10-30T19:00:00.000Z', nowIso: NOW, timeZone: 'UTC', clock })).toBe(
      'Added Vitamin D. First reminder today at 19:00.',
    );
  });

  it('says tomorrow for the next day', () => {
    expect(addedNote({ name: 'Vitamin D', firstDueUtc: '2026-10-31T08:00:00.000Z', nowIso: NOW, timeZone: 'UTC', clock })).toBe(
      'Added Vitamin D. First reminder tomorrow at 08:00.',
    );
  });

  it('names the weekday when it is further away', () => {
    expect(addedNote({ name: 'Iron', firstDueUtc: '2026-11-02T08:00:00.000Z', nowIso: NOW, timeZone: 'UTC', clock })).toBe(
      'Added Iron. First reminder on Monday at 08:00.',
    );
  });

  it('counts days in the phone’s time zone', () => {
    // 08:30 on Saturday in Tokyo; the dose is 19:00 the same Tokyo day.
    expect(
      addedNote({ name: 'Iron', firstDueUtc: '2026-10-31T10:00:00.000Z', nowIso: '2026-10-30T23:30:00.000Z', timeZone: 'Asia/Tokyo', clock }),
    ).toBe('Added Iron. First reminder today at 10:00.');
  });

  it('calls a blank name "my pill" and leaves out a reminder it cannot find', () => {
    expect(addedNote({ name: '  ', firstDueUtc: null, nowIso: NOW, timeZone: 'UTC', clock })).toBe('Added my pill.');
  });
});

describe('glowColour', () => {
  it('glows in the pill’s own colour', () => {
    expect(glowColour('#F2A65A', '#E8D5B5')).toBe('#F2A65A');
  });

  it('glows warm instead of grey for a dark pill, where its own colour would look like a shadow', () => {
    expect(glowColour('#2A2826', '#E8D5B5')).toBe('#E8D5B5');
  });
});

describe('solidColour', () => {
  it('keeps a plain colour', () => {
    expect(solidColour('#F2A65A')).toBe('#F2A65A');
  });

  it('takes the first colour of a two-tone pill', () => {
    expect(solidColour('linear-gradient(90deg, #F5DA6B 50%, #FFFFFF 50%)')).toBe('#F5DA6B');
  });
});
