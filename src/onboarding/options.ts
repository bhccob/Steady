import type { GuardianChannel, MedForm } from '../db/schema';
import type { DropdownOption } from '../ui/Dropdown';

export const MED_FORMS: DropdownOption<MedForm>[] = [
  { value: 'pill', label: 'Pill' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'patch', label: 'Patch' },
  { value: 'injection', label: 'Injection' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
  { value: 'other', label: 'Other' },
];

/** Pill colours to tell meds apart. No red: the palette has none. */
export const PILL_COLOURS: DropdownOption<string>[] = [
  ['White', '#FFFFFF'],
  ['Cream', '#F6EFD9'],
  ['Yellow', '#F5DA6B'],
  ['Orange', '#F2A65A'],
  ['Peach', '#F7C9A8'],
  ['Pink', '#F2C9D2'],
  ['Lavender', '#D6CBEF'],
  ['Purple', '#9F8BD0'],
  ['Light blue', '#BFD9F0'],
  ['Blue', '#719CD2'],
  ['Green', '#A3CFA1'],
  ['Brown', '#A9825F'],
  ['Gray', '#BDBDB8'],
  ['Black', '#2A2826'],
  ['Two-tone', 'linear-gradient(90deg, #F5DA6B 50%, #FFFFFF 50%)'],
].map(([label, swatch]) => ({ value: swatch!, label: label!, swatch: swatch! }));

export const RELATIONSHIPS: DropdownOption<string>[] = ['Partner', 'Parent', 'Sibling', 'Child', 'Friend', 'Carer', 'Doctor or nurse', 'Other'].map(
  (r) => ({ value: r, label: r }),
);

export const CHANNELS: DropdownOption<GuardianChannel>[] = [
  { value: 'inapp', label: 'In the app (Steady)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'sms', label: 'Text message' },
  { value: 'instagram', label: 'Instagram' },
];

/** The contact field changes with the channel. */
export const CONTACT_FIELD: Record<GuardianChannel, { label: string; placeholder: string; hint?: string; phone?: boolean }> = {
  inapp: { label: 'Their Steady code', placeholder: 'STDY-4K7Q', hint: 'They find it in Settings, under Guardians.' },
  whatsapp: { label: 'Phone number', placeholder: '+31 6 1234 5678', phone: true },
  sms: { label: 'Phone number', placeholder: '+31 6 1234 5678', phone: true },
  wechat: { label: 'WeChat ID', placeholder: 'alex_w', hint: 'Steady opens WeChat. You pick the chat there.' },
  instagram: { label: 'Instagram handle', placeholder: '@alex' },
};
