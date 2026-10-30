// Before setup, the web app asks to be installed: on iPhone an installed app keeps its own
// storage (a Safari tab's data is left behind on install, and wiped after 7 days unused), and
// only an installed app can get reminders.

export type InstallStep = 'installed' | 'ios-steps' | 'install-button' | 'browser-steps';

export interface InstallEnv {
  /** Opened from the Home Screen or as an installed app. */
  standalone: boolean;
  ios: boolean;
  /** The browser offered its own install prompt (Chrome and Edge). */
  canPrompt: boolean;
  /** The person chose to carry on in the browser this time. */
  continueInBrowser: boolean;
}

export function installStep(env: InstallEnv): InstallStep {
  if (env.standalone || env.continueInBrowser) return 'installed';
  if (env.ios) return 'ios-steps';
  return env.canPrompt ? 'install-button' : 'browser-steps';
}
