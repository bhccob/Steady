import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DB_NAME, migrate } from '../src/db/migrations';
import { usePerfProbe } from '../src/lib/perf';
import { NotificationBridge } from '../src/notify/NotificationBridge';
import { useTheme } from '../src/theme/useTheme';

// Root: migrations run before any screen renders. Biometric gate arrives in P1.
export default function RootLayout() {
  const theme = useTheme();
  usePerfProbe();

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
        <NotificationBridge />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background[0] } }} />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
