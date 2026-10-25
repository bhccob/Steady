import { LEVEL_RULES, stillUpFor, suggestedLevel } from '../level';

describe('suggestedLevel', () => {
  it('keeps a light touch when nothing is selected', () => {
    expect(suggestedLevel([])).toBe('light');
  });

  it.each([
    [[{ name: 'Cocaine use', severity: 0 }], 'light'],
    [[{ name: 'Cocaine use', severity: 1 }], 'steady'],
    [[{ name: 'Cocaine use', severity: 2 }], 'steady'],
    [[{ name: 'Psychosis', severity: 0 }], 'steady'],
    [[{ name: 'Psychosis', severity: 2 }], 'close'],
    [[{ name: 'Opioid use', severity: 2 }], 'close'],
  ] as const)('%j suggests %s', (conditions, want) => {
    expect(suggestedLevel(conditions)).toBe(want);
  });

  it.each([
    'Schizoaffective disorder',
    'Delusional disorder',
    'Borderline personality disorder',
    'Anorexia',
    'Methamphetamine use',
    'Self-harm',
  ])('counts %s as needing more care: severe suggests close', (name) => {
    expect(suggestedLevel([{ name, severity: 2 }])).toBe('close');
  });

  it('keeps severe depression at steady', () => {
    expect(suggestedLevel([{ name: 'Depression', severity: 2 }])).toBe('steady');
  });

  it('always suggests close for thoughts of suicide, even when mild', () => {
    expect(suggestedLevel([{ name: 'Thoughts of suicide', severity: 0 }])).toBe('close');
  });

  it('follows the condition that needs the most care', () => {
    expect(suggestedLevel([{ name: 'Anxiety', severity: 0 }, { name: 'Bipolar disorder', severity: 2 }])).toBe('close');
  });

  it('treats a condition it does not know like a common one', () => {
    expect(suggestedLevel([{ name: 'Something else', severity: 1 }])).toBe('steady');
    expect(suggestedLevel([{ name: 'Not in the list', severity: 0 }])).toBe('light');
  });
});

describe('LEVEL_RULES', () => {
  it('reminds more and offers help sooner as the level rises', () => {
    expect(LEVEL_RULES.light.remindersPerDose).toBeLessThan(LEVEL_RULES.steady.remindersPerDose);
    expect(LEVEL_RULES.steady.remindersPerDose).toBeLessThan(LEVEL_RULES.close.remindersPerDose);
    expect(LEVEL_RULES.light.helpAfterMin).toBeNull();
    expect(LEVEL_RULES.close.helpAfterMin!).toBeLessThan(LEVEL_RULES.steady.helpAfterMin!);
  });

  it('never goes past five reminders for one dose', () => {
    expect(Math.max(...Object.values(LEVEL_RULES).map((r) => r.remindersPerDose))).toBeLessThanOrEqual(5);
  });
});

describe('stillUpFor', () => {
  it('uses the level unless the user picked their own setting', () => {
    expect(stillUpFor('close', null)).toBe('every15');
    expect(stillUpFor('light', null)).toBe('once');
    expect(stillUpFor('close', 'off')).toBe('off');
  });
});
