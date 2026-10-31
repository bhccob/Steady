import { Stack } from 'expo-router';

import { useTheme } from '../../src/theme/useTheme';

/** Signing in with email: email, code, then restore or choose. Opened from the welcome screen and Settings. */
export default function AccountLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background[0] } }} />;
}
