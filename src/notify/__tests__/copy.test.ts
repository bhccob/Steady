import { ACTION_LABELS, COPY, doseBody, WEB_COPY } from '../copy';

// Spec §5.5. Every string a notification can show passes these rules.
const SHAME = /\b(missed|late|forgot|forgotten)\b|don'?t forget/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const SHOUTING = /\b[A-Z]{2,}\b/;

function everyString(name: string): string[] {
  return [
    ...[3, 4, 5].flatMap((n) => Array.from({ length: n }, (_, k) => doseBody(name, k, n))),
    COPY.collapsed,
    COPY.windDown(name),
    COPY.stillUp,
    ...Object.values(ACTION_LABELS),
    ...Object.values(WEB_COPY),
  ];
}

describe.each(['sam', ''])('notification copy for name "%s"', (name) => {
  const strings = everyString(name);

  it('has no exclamation marks', () => {
    for (const s of strings) expect(s).not.toContain('!');
  });

  it('has no emoji', () => {
    for (const s of strings) expect(s).not.toMatch(EMOJI);
  });

  it('has no words in capitals', () => {
    for (const s of strings) expect(s).not.toMatch(SHOUTING);
  });

  it('never says missed, late, forgot or "don\'t forget"', () => {
    for (const s of strings) expect(s).not.toMatch(SHAME);
  });
});

describe('dose reminders', () => {
  it('follow the spec wording for three reminders', () => {
    expect([0, 1, 2].map((k) => doseBody('sam', k, 3))).toEqual(["sam, a small mark when you're ready.", 'still here.', "no rush. it's here when you are."]);
  });

  it('leave the name out when there is none', () => {
    expect(doseBody('  ', 0, 3)).toBe("a small mark when you're ready.");
  });

  it('use a gentle middle line for the extra reminders at Steady and Close', () => {
    expect([0, 1, 2, 3, 4].map((k) => doseBody('sam', k, 5))).toEqual([
      "sam, a small mark when you're ready.",
      'still here.',
      "whenever you're ready.",
      "whenever you're ready.",
      "no rush. it's here when you are.",
    ]);
  });
});
