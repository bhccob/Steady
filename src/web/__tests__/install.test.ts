import { installStep, opensDatabase, type InstallStep } from '../install';

const env = { standalone: false, ios: false, canPrompt: false, continueInBrowser: false, justInstalled: false };

it('lets an installed app straight in', () => expect(installStep({ ...env, standalone: true })).toBe('installed'));
it('shows the Share steps on iPhone', () => expect(installStep({ ...env, ios: true })).toBe('ios-steps'));
it('offers the install button when the browser can prompt', () => expect(installStep({ ...env, canPrompt: true })).toBe('install-button'));
it('explains the browser menu when there is no prompt (e.g. after dismissing it)', () => expect(installStep(env)).toBe('browser-steps'));
it('lets someone continue in the browser by choice', () => expect(installStep({ ...env, ios: true, continueInBrowser: true })).toBe('installed'));
it('after installing from this tab, says to open it from the Home Screen', () => expect(installStep({ ...env, justInstalled: true })).toBe('open-installed'));

// The tab showing the install screen must not take the database, or the app it installs would
// open to "Steady is open somewhere else".
it('opens the database only once past the install screen', () => {
  const steps: InstallStep[] = ['installed', 'open-installed', 'ios-steps', 'install-button', 'browser-steps'];
  expect(steps.filter(opensDatabase)).toEqual(['installed']);
});
