import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/**
 * True where notification buttons can be handled in the background, without opening Steady:
 * Android development and store builds. iOS and Expo Go can't deliver a button to a closed
 * app, so there the buttons that must always count open the app instead.
 */
export function handlesButtonsInBackground(): boolean {
  return Platform.OS === 'android' && !isRunningInExpoGo();
}
