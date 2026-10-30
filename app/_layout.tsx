import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DB_NAME, migrate } from '../src/db/migrations';
import { usePerfProbe } from '../src/lib/perf';
import { NotificationBridge } from '../src/notify/NotificationBridge';
import { PrivacyGate } from '../src/privacy/PrivacyGate';
import { useTheme } from '../src/theme/useTheme';
import { persistStorage, registerServiceWorker } from '../src/web/startWeb';

// Root: migrations run before any screen renders. Biometric gate arrives in P1.
export default function RootLayout() {
  const theme = useTheme();
  usePerfProbe();
  useEffect(() => {
    registerServiceWorker();
    persistStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
        <NotificationBridge />
        <PrivacyGate />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background[0] } }} />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
