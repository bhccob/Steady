import { installStep } from '../install';

const env = { standalone: false, ios: false, canPrompt: false, continueInBrowser: false };

it('lets an installed app straight in', () => expect(installStep({ ...env, standalone: true })).toBe('installed'));
it('shows the Share steps on iPhone', () => expect(installStep({ ...env, ios: true })).toBe('ios-steps'));
it('offers the install button when the browser can prompt', () => expect(installStep({ ...env, canPrompt: true })).toBe('install-button'));
it('explains the browser menu when there is no prompt (e.g. after dismissing it)', () => expect(installStep(env)).toBe('browser-steps'));
it('lets someone continue in the browser by choice', () => expect(installStep({ ...env, ios: true, continueInBrowser: true })).toBe('installed'));
