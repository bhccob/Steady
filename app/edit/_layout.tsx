import { Stack } from 'expo-router';

import { useTheme } from '../../src/theme/useTheme';

/** Pages opened from Settings: what I'm working through, support level, sleep, patterns. */
export default function EditLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background[0] } }} />;
}
