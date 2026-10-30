import { WEB_COPY } from '../../copy';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pushNotice, STRINGS } = require('../../../../public/sw-push.js') as {
  pushNotice: (rec?: { body: string; doseIds?: string[] }, tomb?: { at: number }) => { body: string; doseIds: string[] };
  STRINGS: typeof WEB_COPY;
};

it('shows the reminder in its own words', () => expect(pushNotice({ body: 'still here.', doseIds: ['d'] })).toEqual({ body: 'still here.', doseIds: ['d'] }));
it('says all marked for a reminder cancelled on this phone', () => expect(pushNotice(undefined, { at: 1 }).body).toBe(WEB_COPY.allMarked));
it('falls back to the neutral line for an unknown id', () => expect(pushNotice().body).toBe(WEB_COPY.neutral));
it('uses the same words as the app', () => expect(STRINGS).toEqual(WEB_COPY));
