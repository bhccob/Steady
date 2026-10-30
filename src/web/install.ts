// Before setup, the web app asks to be installed: on iPhone an installed app keeps its own
// storage (a Safari tab's data is left behind on install, and wiped after 7 days unused), and
// only an installed app can get reminders.

export type InstallStep = 'installed' | 'open-installed' | 'ios-steps' | 'install-button' | 'browser-steps';

export interface InstallEnv {
  /** Opened from the Home Screen or as an installed app. */
  standalone: boolean;
  ios: boolean;
  /** The browser offered its own install prompt (Chrome and Edge). */
  canPrompt: boolean;
  /** The person chose to carry on in the browser this time. */
  continueInBrowser: boolean;
  /** Installed from this tab just now: the app opens from the Home Screen, not here. */
  justInstalled: boolean;
}

export function installStep(env: InstallEnv): InstallStep {
  if (env.standalone || env.continueInBrowser) return 'installed';
  if (env.justInstalled) return 'open-installed';
  if (env.ios) return 'ios-steps';
  return env.canPrompt ? 'install-button' : 'browser-steps';
}

/** Only a tab past the install screen opens the database, so the app it installs can (see dbLock.ts). */
export function opensDatabase(step: InstallStep): boolean {
  return step === 'installed';
}
