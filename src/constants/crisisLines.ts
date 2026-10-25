/** Free, 24/7 lines from spec §7.2. Shown to everyone, always; never gated. */
export interface CrisisLine {
  country: string;
  number: string;
}

const BY_REGION: Record<string, CrisisLine> = {
  US: { country: 'United States', number: '988' },
  CA: { country: 'Canada', number: '988' },
  GB: { country: 'United Kingdom', number: '116 123' },
  NL: { country: 'Netherlands', number: '113' },
  AU: { country: 'Australia', number: '13 11 14' },
};

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const EU_LINE: CrisisLine = { country: 'Europe', number: '116 123' };

export const ALL_CRISIS_LINES: CrisisLine[] = [...Object.values(BY_REGION), EU_LINE];

/** The line for the phone's region, or null when we don't have one (then show them all). */
export function crisisLineFor(region: string | null | undefined): CrisisLine | null {
  if (!region) return null;
  return BY_REGION[region] ?? (EU.includes(region) ? EU_LINE : null);
}
