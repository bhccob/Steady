import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { DECOR_FONT_SCALE, motion, type Theme } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import type { PathEntry } from './path';

const STEP = 97;
const ZIGZAG = [0, 26, 38, 26, 0, -26, -38, -26];
/** Undo the plane's 60° tilt so labels stay readable. */
const UPRIGHT = { transform: [{ scaleY: 1.9 }] };

function tileStyle(e: PathEntry, t: Theme): ViewStyle {
  const dark = t.name === 'dark';
  if (e.kind === 'trophy') {
    if (e.state === 'got') return { backgroundColor: t.accentDeep, borderBottomWidth: 11, borderBottomColor: '#A8916A' };
    if (e.state === 'ready')
      return { backgroundColor: t.accent, borderWidth: 4, borderColor: t.accentLine, borderBottomWidth: 11, borderBottomColor: t.accentDeep, boxShadow: '0px 0px 30px 10px rgba(232, 213, 181, 0.9)' };
    return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)', borderWidth: 2, borderColor: t.accentLine };
  }
  switch (e.state) {
    case 'done':
      return { backgroundColor: t.accent, borderBottomWidth: 10, borderBottomColor: t.accentDeep, ...(e.isToday ? { borderWidth: 3, borderColor: t.accentLine } : null) };
    case 'today':
      return { backgroundColor: t.background[0], borderWidth: 4, borderColor: t.accentLine };
    case 'rest':
      return { backgroundColor: 'transparent', borderWidth: 4, borderColor: t.text.secondary };
    case 'past':
      return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)', borderBottomWidth: 10, borderBottomColor: 'rgba(120, 120, 110, 0.15)' };
    default:
      return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.75)', borderBottomWidth: 10, borderBottomColor: 'rgba(120, 120, 110, 0.2)' };
  }
}

function Face({ e, t }: { e: PathEntry; t: Theme }) {
  const ink = e.kind === 'day' && e.state === 'done' ? t.onAccent : t.text.primary;
  if (e.kind === 'trophy') {
    return (
      <View style={[styles.face, UPRIGHT]}>
        <Icon name="award" size={22} color={t.onAccent} />
        <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.small, { color: t.onAccent }]}>
          {e.state === 'got' ? '+50' : e.state === 'ready' ? 'COLLECT' : 'WEEK'}
        </AppText>
      </View>
    );
  }
  const top = e.state === 'done' ? null : e.state === 'today' ? 'TODAY' : e.state === 'rest' ? 'REST' : e.weekday.toUpperCase();
  return (
    <View style={[styles.face, UPRIGHT]}>
      {top ? (
        <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.small, { color: ink }]}>
          {top}
        </AppText>
      ) : (
        <Icon name="check" size={13} color={ink} />
      )}
      <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.num, { color: ink }]}>
        {e.day}
      </AppText>
    </View>
  );
}

function a11yLabel(e: PathEntry): string {
  if (e.kind === 'trophy') return `Week trophy, ${e.label}, ${e.state === 'got' ? 'collected' : e.state === 'ready' ? 'ready to collect' : 'ready on Sunday night'}`;
  const what = { done: 'marked', rest: 'rest day', today: 'not marked yet', past: 'nothing marked', ahead: 'ahead' }[e.state];
  return `${e.weekday} ${e.day}${e.isToday ? ', today' : ''}, ${what}`;
}

interface StreakPathProps {
  entries: PathEntry[];
  /** The entry the camera rests on: today once marked, the day before otherwise. */
  focus: number;
  onTap: (index: number) => void;
  /** Lets the screen pause its own scrolling while the path is dragged. */
  onDragChange?: (dragging: boolean) => void;
}

/** The streak as blocks on a path tilted back in 3D. Drag down to look back; tap a block for that day. */
export function StreakPath({ entries, focus, onTap, onDragChange }: StreakPathProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const height = entries.length * STEP + 220;

  // The latest props for the gesture handlers, which are made once.
  const live = useRef({ onDragChange, reduced, max: (entries.length - 1) * STEP });
  useLayoutEffect(() => {
    live.current = { onDragChange, reduced, max: (entries.length - 1) * STEP };
  });
  const base = useRef(focus * STEP);
  const [shift] = useState(() => new Animated.Value(focus * STEP));

  // The handlers read `live` and `base` only when a drag happens or focus changes, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [{ settle, pan }] = useState(() => {
    const move = (to: number) => {
      base.current = to;
      if (live.current.reduced) shift.setValue(to);
      else Animated.spring(shift, { toValue: to, useNativeDriver: true, ...motion.spring }).start();
    };
    const clamp = (v: number) => Math.max(0, Math.min(live.current.max, v));
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => live.current.onDragChange?.(true),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => shift.setValue(clamp(base.current - g.dy * 1.6)),
      onPanResponderRelease: (_, g) => {
        live.current.onDragChange?.(false);
        move(Math.round(clamp(base.current - g.dy * 1.6) / STEP) * STEP);
      },
      onPanResponderTerminate: () => {
        live.current.onDragChange?.(false);
        move(base.current);
      },
    });
    return { settle: move, pan: responder };
  });

  useEffect(() => {
    settle(focus * STEP);
  }, [focus, reduced, settle]);

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <Animated.View
        style={[
          styles.plane,
          { height, transform: [{ perspective: 520 }, { rotateX: '60deg' }, { translateY: shift }] },
        ]}
      >
        {entries.map((e, i) => {
          const size = e.kind === 'trophy' ? 68 : 60;
          return (
            <Pressable
              key={e.kind === 'day' ? e.date : `trophy-${e.weekStart}`}
              accessibilityRole="button"
              accessibilityLabel={a11yLabel(e)}
              accessibilityHint="Shows that day"
              onPress={() => onTap(i)}
              style={[
                styles.tile,
                { width: size, height: size, marginLeft: -size / 2 + ZIGZAG[i % ZIGZAG.length]!, top: height - 140 - i * STEP, borderRadius: e.kind === 'trophy' ? 22 : 18 },
                tileStyle(e, theme),
              ]}
            >
              <Face e={e} t={theme} />
            </Pressable>
          );
        })}
      </Animated.View>
      <View pointerEvents="none" style={[styles.fadeTop, { backgroundImage: `linear-gradient(to bottom, ${theme.background[0]} 10%, transparent)` }]} />
      <View pointerEvents="none" style={[styles.fadeBottom, { backgroundImage: `linear-gradient(to top, ${theme.background[1]}, transparent)` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  plane: { position: 'absolute', left: 0, right: 0, bottom: -30, transformOrigin: '50% 100%' },
  tile: { position: 'absolute', left: '73%', alignItems: 'center', justifyContent: 'center' },
  face: { alignItems: 'center', gap: 2 },
  small: { fontSize: 9, lineHeight: 11, fontWeight: '600', letterSpacing: 0.2 },
  num: { fontSize: 17, lineHeight: 20, fontWeight: '600' },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 110 },
  fadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
});
