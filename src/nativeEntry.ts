// Background work for Android development and store builds, registered before the app loads, so
// a tap on a closed app's notification button or widget finds its handler. Expo Go has neither
// native side, so it skips both; the web has its own empty twin (nativeEntry.web.ts).
import { isRunningInExpoGo } from 'expo';

if (!isRunningInExpoGo()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./notify/backgroundTask');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./widget/register');
}
