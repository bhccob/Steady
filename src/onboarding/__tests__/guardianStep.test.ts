import type { DraftGuardian } from '../draft';
import { guardianButton } from '../guardianStep';

const empty: DraftGuardian = { name: '', relationship: 'Friend', channel: 'whatsapp', contact: '' };

describe('guardianButton', () => {
  it('moves on without a guardian when the form is left empty', () => {
    expect(guardianButton(empty)).toEqual({ label: 'Continue', action: 'skip' });
  });

  it('offers to add them by name once a name is typed', () => {
    expect(guardianButton({ ...empty, name: '  Alex ' })).toEqual({ label: 'Add Alex', action: 'add' });
  });

  it('says "Add them" when the name is too long for the button', () => {
    expect(guardianButton({ ...empty, name: 'Alexandra Montgomery-Smith' })).toEqual({ label: 'Add them', action: 'add' });
  });

  it('asks for a name when only their contact was filled in', () => {
    expect(guardianButton({ ...empty, contact: '+44 7700 900123' })).toEqual({ label: 'Continue', action: 'needs_name' });
  });
});
