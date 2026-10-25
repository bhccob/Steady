// App entry. In an Android development or store build, background work is registered before
// the app loads, so a tap on a closed app's notification button or widget finds its handler.
// Expo Go has neither native side, so it skips both.
import { isRunningInExpoGo } from 'expo';
import 'expo-router/entry';

if (!isRunningInExpoGo()) {
  require('./src/notify/backgroundTask');
  require('./src/widget/register');
}
