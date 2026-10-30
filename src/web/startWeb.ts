import { Platform } from 'react-native';

// Web-only start-up chores, each a no-op on phones.

/** The service worker that lets the installed app open with no signal (public/sw.js). */
export function registerServiceWorker(): void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Once installed, asks the browser not to clear Steady's data when space runs low. */
export function persistStorage(): void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
  if (standalone) nav.storage?.persist?.().catch(() => {});
}
