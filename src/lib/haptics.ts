import { impactAsync, ImpactFeedbackStyle, notificationAsync, NotificationFeedbackType } from 'expo-haptics';

// Small physical confirmations (spec §8.2, §9.4). Never required to understand anything,
// and a phone without haptics just skips them.

/** A dose was marked. */
export function markHaptic(): void {
  impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A trophy was collected, or a comeback. */
export function celebrateHaptic(): void {
  notificationAsync(NotificationFeedbackType.Success).catch(() => {});
}

/** A quiet choice: Goodnight, a mood. */
export function lightHaptic(): void {
  impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
}
