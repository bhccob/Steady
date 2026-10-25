import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { Icon } from '../ui/Icon';

type Kind = 'done' | 'today' | 'ahead';

const TILES: { kind: Kind; x: number; y: number }[] = [
  { kind: 'done', x: -22, y: 0 },
  { kind: 'done', x: 22, y: 97 },
  { kind: 'today', x: -14, y: 194 },
  { kind: 'ahead', x: 22, y: 291 },
  { kind: 'ahead', x: -14, y: 388 },
  { kind: 'ahead', x: 18, y: 485 },
];

/** Decorative: the streak path tilted back in 3D, fading into the distance. */
export function WelcomePath() {
  const theme = useTheme();
  const tile = (k: Kind) =>
    k === 'done'
      ? { backgroundColor: theme.accent, borderBottomWidth: 10, borderBottomColor: theme.accentDeep }
      : k === 'today'
        ? { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: theme.accentLine }
        : { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderBottomWidth: 10, borderBottomColor: 'rgba(120, 120, 110, 0.2)' };

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.plane, { transform: [{ perspective: 600 }, { rotateX: '58deg' }] }]}>
        {TILES.map((t, i) => (
          <View key={i} style={[styles.tile, { marginLeft: -30 + t.x, bottom: 30 + t.y, opacity: 1 - i * 0.12 }, tile(t.kind)]}>
            {t.kind === 'done' ? (
              <View style={styles.upright}>
                <Icon name="check" size={24} color={theme.onAccent} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={[styles.fade, { backgroundImage: `linear-gradient(to bottom, ${theme.background[0]}, transparent)` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 270, marginHorizontal: -20, overflow: 'hidden' },
  plane: { position: 'absolute', left: 0, right: 0, bottom: -20, height: 600, transformOrigin: '50% 100%' },
  tile: { position: 'absolute', left: '50%', width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  upright: { transform: [{ scaleY: 1.9 }] },
  fade: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
});
