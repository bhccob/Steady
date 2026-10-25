// What someone can say they are working through, for onboarding and Settings.
// Weights feed the support level (see level.ts); they are not clinical and should be
// reviewed by a clinician before release.

export interface ConditionInfo {
  name: string;
  /** 1 for most; 2 where steady doses and sleep matter most; 4 always suggests Close. */
  weight: number;
  /** Everyday words search should also find it by. */
  aliases?: string;
}

export const CONDITION_GROUPS: readonly { title: string; conditions: readonly ConditionInfo[] }[] = [
  {
    title: 'Mood',
    conditions: [
      { name: 'Depression', weight: 1 },
      { name: 'Bipolar disorder', weight: 2, aliases: 'manic mania' },
      { name: 'Persistent depression (dysthymia)', weight: 1 },
      { name: 'Postnatal depression', weight: 1, aliases: 'postpartum' },
      { name: 'Seasonal depression', weight: 1, aliases: 'sad seasonal affective' },
      { name: 'PMDD', weight: 1, aliases: 'premenstrual dysphoric' },
    ],
  },
  {
    title: 'Anxiety and stress',
    conditions: [
      { name: 'Anxiety', weight: 1, aliases: 'gad generalised generalized worry' },
      { name: 'Panic disorder', weight: 1, aliases: 'panic attacks' },
      { name: 'Social anxiety', weight: 1 },
      { name: 'Health anxiety', weight: 1, aliases: 'hypochondria' },
      { name: 'OCD', weight: 1, aliases: 'obsessive compulsive' },
      { name: 'PTSD', weight: 1, aliases: 'trauma post-traumatic' },
      { name: 'Complex PTSD', weight: 1, aliases: 'cptsd c-ptsd trauma' },
    ],
  },
  {
    title: 'Psychosis',
    conditions: [
      { name: 'Psychosis', weight: 2, aliases: 'hearing voices' },
      { name: 'Schizophrenia', weight: 2 },
      { name: 'Schizoaffective disorder', weight: 2 },
      { name: 'Delusional disorder', weight: 2 },
    ],
  },
  {
    title: 'Self-harm and suicidal thoughts',
    conditions: [
      { name: 'Self-harm', weight: 2, aliases: 'self harm cutting' },
      { name: 'Thoughts of suicide', weight: 4, aliases: 'suicidal' },
    ],
  },
  {
    title: 'Eating',
    conditions: [
      { name: 'Anorexia', weight: 2 },
      { name: 'Bulimia', weight: 1 },
      { name: 'Binge eating', weight: 1 },
      { name: 'ARFID', weight: 1, aliases: 'avoidant restrictive' },
    ],
  },
  {
    title: 'Personality',
    conditions: [{ name: 'Borderline personality disorder', weight: 2, aliases: 'bpd eupd emotionally unstable' }],
  },
  {
    title: 'ADHD and autism',
    conditions: [
      { name: 'ADHD', weight: 1, aliases: 'add attention deficit' },
      { name: 'Autism', weight: 1, aliases: 'asd asperger autistic' },
    ],
  },
  {
    title: 'Substance use',
    conditions: [
      { name: 'Alcohol use', weight: 1, aliases: 'drinking alcoholism' },
      { name: 'Cannabis use', weight: 1, aliases: 'weed marijuana thc' },
      { name: 'Cocaine use', weight: 1, aliases: 'coke crack' },
      { name: 'Opioid use', weight: 2, aliases: 'heroin fentanyl painkillers methadone oxycodone' },
      { name: 'Methamphetamine use', weight: 2, aliases: 'meth crystal ice speed' },
      { name: 'Benzodiazepine use', weight: 1, aliases: 'benzos xanax valium' },
      { name: 'Ketamine use', weight: 1, aliases: 'ket' },
      { name: 'Smoking or vaping', weight: 1, aliases: 'nicotine cigarettes' },
      { name: 'Gambling', weight: 1, aliases: 'betting' },
    ],
  },
  {
    title: 'Sleep',
    conditions: [{ name: 'Insomnia', weight: 1, aliases: 'sleep' }],
  },
  {
    title: 'Physical health',
    conditions: [
      { name: 'Epilepsy', weight: 1, aliases: 'seizures' },
      { name: 'Diabetes', weight: 1 },
      { name: 'High blood pressure', weight: 1, aliases: 'hypertension' },
      { name: 'Heart condition', weight: 1 },
      { name: 'HIV', weight: 1 },
      { name: 'Chronic pain', weight: 1 },
    ],
  },
];

export const CONDITIONS: readonly ConditionInfo[] = CONDITION_GROUPS.flatMap((g) => g.conditions);

const MAX_NAME = 40;

/** Groups with the names that match the search; the user's own additions come first. */
export function searchConditions(query: string, own: readonly string[]): { title: string; names: string[] }[] {
  const q = query.trim().toLowerCase();
  const groups = [{ title: 'Your own', conditions: own.map((name): ConditionInfo => ({ name, weight: 1 })) }, ...CONDITION_GROUPS];
  return groups
    .map((g) => ({
      title: g.title,
      names: g.conditions.filter((c) => `${c.name} ${c.aliases ?? ''}`.toLowerCase().includes(q)).map((c) => c.name),
    }))
    .filter((g) => g.names.length > 0);
}

/** The name to add from a search, or null when it is empty or already listed. */
export function addableName(query: string, own: readonly string[]): string | null {
  const name = query.trim().slice(0, MAX_NAME);
  if (!name) return null;
  const lower = name.toLowerCase();
  if ([...CONDITIONS.map((c) => c.name), ...own].some((n) => n.toLowerCase() === lower)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
