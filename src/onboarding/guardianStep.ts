import type { DraftGuardian } from './draft';

const MAX_LABEL_NAME = 18;

/** The guardian step's one button: move on, add them, or ask for the name first. */
export function guardianButton(g: DraftGuardian): { label: string; action: 'skip' | 'add' | 'needs_name' } {
  const name = g.name.trim();
  if (name) return { label: name.length <= MAX_LABEL_NAME ? `Add ${name}` : 'Add them', action: 'add' };
  return { label: 'Continue', action: g.contact.trim() ? 'needs_name' : 'skip' };
}
