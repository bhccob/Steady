import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { installStep, type InstallEnv, type InstallStep } from './install';

const CONTINUE_KEY = 'steady-continue-in-browser';

type InstallPromptEvent = Event & { prompt(): Promise<void> };

// Chrome offers its install prompt once, early; keep it for the install screen's button.
let offered: InstallPromptEvent | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offered = e as InstallPromptEvent;
  });
}

function readEnv(): InstallEnv {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { standalone: true, ios: false, canPrompt: false, continueInBrowser: false };
  let continueInBrowser = false;
  try {
    continueInBrowser = window.sessionStorage.getItem(CONTINUE_KEY) === '1';
  } catch {
    // Storage blocked (private mode): the install screen shows each time, which is fine.
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true,
    ios: /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
    canPrompt: offered !== null,
    continueInBrowser,
  };
}

/** Whether to show the install screen, and what it can do. Always "installed" on phones. */
export function useInstall(): { step: InstallStep; prompt(): Promise<void>; continueInBrowser(): void } {
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
      await event?.prompt();
      setEnv(readEnv());
    },
    continueInBrowser: () => {
      try {
        window.sessionStorage.setItem(CONTINUE_KEY, '1');
      } catch {
        // Without storage the choice lasts until the page reloads.
      }
      setEnv({ ...readEnv(), continueInBrowser: true });
    },
  };
}
