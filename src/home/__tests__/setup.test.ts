import { setupList, type SetupFacts } from '../setup';

const fresh: SetupFacts = {
  hasPills: false,
  remindersOn: false,
  conditionCount: 0,
  levelChosen: false,
  bedtimeSet: false,
  guardianCount: 0,
  answered: [],
  hidden: false,
};

const doneSteps = (f: Partial<SetupFacts>) => setupList({ ...fresh, ...f })?.filter((r) => r.done).map((r) => r.step);

describe('setupList', () => {
  it('lists the five steps in order, none done, for someone who just started', () => {
    expect(setupList(fresh)).toEqual([
      { step: 'pill', done: false },
      { step: 'reminders', done: false },
      { step: 'support', done: false },
      { step: 'sleep', done: false },
      { step: 'someone', done: false },
    ]);
  });

  it('ticks each step off from what is saved', () => {
    expect(doneSteps({ hasPills: true })).toEqual(['pill']);
    expect(doneSteps({ remindersOn: true })).toEqual(['reminders']);
    expect(doneSteps({ conditionCount: 2 })).toEqual(['support']);
    expect(doneSteps({ levelChosen: true })).toEqual(['support']);
    expect(doneSteps({ bedtimeSet: true })).toEqual(['sleep']);
    expect(doneSteps({ guardianCount: 1 })).toEqual(['someone']);
  });

  it('counts support and bedtime as done once answered, even when nothing was picked', () => {
    expect(doneSteps({ answered: ['support', 'sleep'] })).toEqual(['support', 'sleep']);
  });

  it('is gone once every step is done', () => {
    expect(setupList({ ...fresh, hasPills: true, remindersOn: true, answered: ['support', 'sleep'], guardianCount: 1 })).toBeNull();
  });

  it('is gone once hidden, whatever is left', () => {
    expect(setupList({ ...fresh, hidden: true })).toBeNull();
  });
});
