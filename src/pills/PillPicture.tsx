import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { MedForm } from '../db/schema';
import { useTheme } from '../theme/useTheme';
import { glowColour } from './note';

/** A colour from the pill list as a fill: two-tone is a CSS gradient. */
function fill(colour: string): ViewStyle {
  return colour.startsWith('linear-gradient') ? { backgroundImage: colour } : { backgroundColor: colour };
}

const EDGE = 'rgba(27, 22, 19, 0.14)';
const SOFT_3D = '0px 6px 14px rgba(60, 45, 25, 0.22), inset 0px -4px 0px rgba(0, 0, 0, 0.12)';
const SHINE = 'rgba(255, 255, 255, 0.5)';
const CAP = 'rgba(27, 22, 19, 0.72)';

/**
 * A soft 3D drawing of a pill in its own colour and shape, with a glow behind it. Decorative:
 * whatever holds it carries the spoken label.
 */
export function PillPicture({ form, colour, size = 140, glow = true }: { form: MedForm; colour: string; size?: number; glow?: boolean }) {
  const theme = useTheme();
  const u = size / 100;
  return (
    <View style={{ width: size, height: size * 0.62, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {glow ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(circle at 50% 50%, ${glowColour(colour, theme.accent)}99, transparent 62%)` }]}
        />
      ) : null}
      <Shape form={form} colour={colour} u={u} />
    </View>
  );
}

function Shape({ form, colour, u }: { form: MedForm; colour: string; u: number }) {
  const body = [fill(colour), { borderWidth: 1, borderColor: EDGE, boxShadow: SOFT_3D, overflow: 'hidden' as const }];
  const shine = (w: number, top: number) => <View style={{ position: 'absolute', left: '14%', top: top * u, height: 4 * u, width: `${w}%`, borderRadius: 99, backgroundColor: SHINE }} />;

  switch (form) {
    case 'capsule':
      return (
        <View style={[body, { width: 74 * u, height: 31 * u, borderRadius: 99, flexDirection: 'row', transform: [{ rotate: '-14deg' }] }]}>
          <View style={styles.grow} />
          <View style={[styles.grow, { borderLeftWidth: 1, borderLeftColor: EDGE, backgroundColor: 'rgba(255, 255, 255, 0.4)' }]} />
          <View style={{ position: 'absolute', left: 9 * u, right: 9 * u, top: 5 * u, height: 5 * u, borderRadius: 99, backgroundColor: SHINE }} />
        </View>
      );
    case 'pill':
      return (
        <View style={[body, { width: 44 * u, height: 44 * u, borderRadius: 99, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }] }]}>
          <View style={{ width: '70%', height: 2 * u, borderRadius: 99, backgroundColor: 'rgba(27, 22, 19, 0.16)' }} />
          <View style={{ position: 'absolute', left: 10 * u, top: 6 * u, width: 14 * u, height: 5 * u, borderRadius: 99, backgroundColor: SHINE }} />
        </View>
      );
    case 'liquid':
      return (
        <View style={styles.center}>
          <View style={{ width: 16 * u, height: 8 * u, borderTopLeftRadius: 3 * u, borderTopRightRadius: 3 * u, backgroundColor: CAP }} />
          <View style={[body, { width: 34 * u, height: 42 * u, borderRadius: 8 * u, justifyContent: 'center' }]}>
            <View style={{ height: 14 * u, backgroundColor: 'rgba(255, 255, 255, 0.55)' }} />
            {shine(30, 4)}
          </View>
        </View>
      );
    case 'drops':
      return (
        <View style={styles.center}>
          <View style={{ width: 12 * u, height: 12 * u, borderRadius: 99, backgroundColor: CAP }} />
          <View style={{ width: 7 * u, height: 10 * u, backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: EDGE }} />
          <View style={[body, { width: 28 * u, height: 30 * u, borderRadius: 7 * u }]}>{shine(30, 4)}</View>
        </View>
      );
    case 'patch':
      return (
        <View style={[body, { width: 46 * u, height: 46 * u, borderRadius: 10 * u, padding: 6 * u, transform: [{ rotate: '-10deg' }] }]}>
          <View style={{ flex: 1, borderRadius: 6 * u, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255, 255, 255, 0.85)' }} />
        </View>
      );
    case 'inhaler':
      return (
        <View style={[styles.center, { transform: [{ rotate: '-10deg' }] }]}>
          <View style={{ width: 14 * u, height: 14 * u, borderTopLeftRadius: 4 * u, borderTopRightRadius: 4 * u, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderWidth: 1, borderColor: EDGE }} />
          <View style={[body, { width: 26 * u, height: 32 * u, borderRadius: 7 * u }]}>{shine(30, 4)}</View>
          <View style={[fill(colour), { width: 22 * u, height: 10 * u, marginLeft: -26 * u, marginTop: -2 * u, borderBottomLeftRadius: 5 * u, borderBottomRightRadius: 5 * u, borderWidth: 1, borderColor: EDGE }]} />
        </View>
      );
    case 'injection':
      return (
        <View style={[body, { width: 74 * u, height: 15 * u, borderRadius: 99, flexDirection: 'row', alignItems: 'center', transform: [{ rotate: '-14deg' }] }]}>
          <View style={{ width: 16 * u, alignSelf: 'stretch', backgroundColor: CAP }} />
          <View style={{ marginLeft: 14 * u, width: 18 * u, height: 6 * u, borderRadius: 2 * u, backgroundColor: 'rgba(255, 255, 255, 0.75)' }} />
        </View>
      );
    default:
      return (
        <View style={[body, { width: 36 * u, height: 36 * u, borderRadius: 99 }]}>
          <View style={{ position: 'absolute', left: 8 * u, top: 5 * u, width: 12 * u, height: 4 * u, borderRadius: 99, backgroundColor: SHINE }} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  center: { alignItems: 'center' },
});
