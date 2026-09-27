// Tactile feedback for the moments that matter while driving: confirm without looking.
import * as Haptics from 'expo-haptics';

const safe = (p: Promise<void>) => { p.catch(() => {}); }; // no haptics engine (simulator, web): ignore

export const haptic = {
  /** Taps on primary actions. */
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Choosing between options (stop type, toggles). */
  select: () => safe(Haptics.selectionAsync()),
  /** A stop delivered, a route planned. */
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something needs attention. */
  warn: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
