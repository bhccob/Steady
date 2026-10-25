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
  EU: { country: 'Europe', number: '116 123' },
};

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

export const ALL_CRISIS_LINES: CrisisLine[] = Object.values(BY_REGION);

/** The choices for "my crisis line" (spec §8.4 manual override). */
export const CRISIS_REGIONS: { value: string; label: string }[] = Object.entries(BY_REGION).map(([value, l]) => ({ value, label: l.country }));

function lookup(region: string | null | undefined): CrisisLine | null {
  if (!region) return null;
  return BY_REGION[region] ?? (EU.includes(region) ? BY_REGION.EU! : null);
}

/** The line for the region the user chose, else the phone's region, else null (then show them all). */
export function crisisLineFor(chosen: string | null | undefined, detected: string | null | undefined): CrisisLine | null {
  return lookup(chosen) ?? lookup(detected);
}
