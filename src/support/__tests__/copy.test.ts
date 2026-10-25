import { levelReason } from '../copy';

describe('levelReason', () => {
  it('lowercases ordinary words but keeps short forms like PTSD in capitals', () => {
    expect(levelReason([{ name: 'Complex PTSD', severity: 2 }, { name: 'ADHD', severity: 0 }, { name: 'Cocaine use', severity: 1 }])).toBe(
      'Based on complex PTSD (severe), ADHD (mild) and cocaine use (moderate).',
    );
  });
});
