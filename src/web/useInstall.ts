import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { installStep, type InstallEnv, type InstallStep } from './install';

const CONTINUE_KEY = 'steady-continue-in-browser';

type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// Chrome offers its install prompt once, early; keep it for the install screen's button.
let offered: InstallPromptEvent | null = null;
// Installed from this tab: the app now opens from the Home Screen, not in this tab.
let installedHere = false;
// The choice to carry on in the browser, kept here too in case storage is blocked.
let continued = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offered = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
  });
}

function readEnv(): InstallEnv {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { standalone: true, ios: false, canPrompt: false, continueInBrowser: false, justInstalled: false };
  let continueInBrowser = continued;
  try {
    continueInBrowser ||= window.sessionStorage.getItem(CONTINUE_KEY) === '1';
  } catch {
    // Storage blocked (private mode): the choice lasts while this page is open.
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true,
    ios: /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
    canPrompt: offered !== null,
    continueInBrowser,
    justInstalled: installedHere,
  };
}

export interface Install {
  step: InstallStep;
  prompt(): Promise<void>;
  continueInBrowser(): void;
}

/** Whether to show the install screen, and what it can do. Always "installed" on phones. */
export function useInstall(): Install {
  const [env, setEnv] = useState(readEnv);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const refresh = () => setEnv(readEnv());
    window.addEventListener('beforeinstallprompt', refresh);
    window.addEventListener('appinstalled', refresh);
    return () => {
      window.removeEventListener('beforeinstallprompt', refresh);
      window.removeEventListener('appinstalled', refresh);
    };
  }, []);

  return {
    step: installStep(env),
    prompt: async () => {
      const event = offered;
      offered = null;
      if (event) {
        await event.prompt();
        if ((await event.userChoice).outcome === 'accepted') installedHere = true;
      }
      setEnv(readEnv());
    },
    continueInBrowser: () => {
      continued = true;
      try {
        window.sessionStorage.setItem(CONTINUE_KEY, '1');
      } catch {
        // Kept in memory instead (above).
      }
      setEnv(readEnv());
    },
  };
}
