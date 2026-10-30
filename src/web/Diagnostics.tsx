import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { getProfile } from '../db/dao/profile';
import { AppText } from '../ui/Text';

/**
 * TEMPORARY, for the iPhone storage check: open the app with ?diag=1 to see whether the
 * database can run here and kept its data. Removed once the check passes.
 */
export function Diagnostics() {
  const db = useSQLiteContext();
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !window.location.search.includes('diag=1')) return;
    (async () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      const profile = await getProfile(db).catch((e: unknown) => `error: ${String(e)}`);
      setLines([
        `cross-origin isolated: ${String(window.crossOriginIsolated)}`,
        `SharedArrayBuffer: ${typeof SharedArrayBuffer !== 'undefined'}`,
        `installed (standalone): ${window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true}`,
        `storage kept: ${String(await nav.storage?.persisted?.())}`,
        `saved name: ${typeof profile === 'string' ? profile : (profile?.displayName ?? '(none yet)')}`,
      ]);
    })();
  }, [db]);

  if (!lines) return null;
  return (
    <View pointerEvents="none" style={styles.panel}>
      {lines.map((l) => (
        <AppText key={l} variant="caption">
          {l}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 48, left: 12, right: 12, padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', zIndex: 1000, gap: 2 },
});
