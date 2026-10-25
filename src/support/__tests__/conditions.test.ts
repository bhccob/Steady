import { addableName, CONDITION_GROUPS, CONDITIONS, searchConditions } from '../conditions';

describe('CONDITIONS', () => {
  it('offers 42 conditions in 10 groups, each name once', () => {
    expect(CONDITION_GROUPS).toHaveLength(10);
    expect(CONDITIONS).toHaveLength(42);
    expect(new Set(CONDITIONS.map((c) => c.name)).size).toBe(42);
  });

  it('keeps the names earlier versions saved, so stored choices still match', () => {
    const names = CONDITIONS.map((c) => c.name);
    for (const old of ['Psychosis', 'Schizophrenia', 'Bipolar disorder', 'Depression', 'Anxiety', 'PTSD', 'Cocaine use', 'Cannabis use', 'Alcohol use', 'Opioid use']) {
      expect(names).toContain(old);
    }
  });
});

describe('searchConditions', () => {
  it('shows every group in order when the search is empty', () => {
    const groups = searchConditions('', []);
    expect(groups.map((g) => g.title)).toEqual(CONDITION_GROUPS.map((g) => g.title));
    expect(groups.flatMap((g) => g.names)).toHaveLength(42);
  });

  it('matches names whatever the case', () => {
    expect(searchConditions('BIPOLAR', [])).toEqual([{ title: 'Mood', names: ['Bipolar disorder'] }]);
  });

  it.each([
    ['weed', 'Cannabis use'],
    ['bpd', 'Borderline personality disorder'],
    ['crystal', 'Methamphetamine use'],
    ['heroin', 'Opioid use'],
    ['suicidal', 'Thoughts of suicide'],
  ])('finds "%s" under its everyday word: %s', (query, name) => {
    expect(searchConditions(query, []).flatMap((g) => g.names)).toContain(name);
  });

  it('shows nothing when nothing matches', () => {
    expect(searchConditions('tourette', [])).toEqual([]);
  });

  it("lists the user's own additions first, under their own heading", () => {
    const groups = searchConditions('', ["Tourette's"]);
    expect(groups[0]).toEqual({ title: 'Your own', names: ["Tourette's"] });
    expect(searchConditions('tour', ["Tourette's"])).toEqual([{ title: 'Your own', names: ["Tourette's"] }]);
  });
});

describe('addableName', () => {
  it('offers nothing for an empty search', () => {
    expect(addableName('   ', [])).toBeNull();
  });

  it('tidies what was typed into a name', () => {
    expect(addableName("  tourette's  ", [])).toBe("Tourette's");
  });

  it('keeps names to 40 characters', () => {
    expect(addableName('x'.repeat(60), [])).toHaveLength(40);
  });

  it('offers nothing when the name is already in the list or already added', () => {
    expect(addableName('depression', [])).toBeNull();
    expect(addableName("TOURETTE'S", ["Tourette's"])).toBeNull();
  });
});
