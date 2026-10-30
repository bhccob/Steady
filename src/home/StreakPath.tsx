import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { DECOR_FONT_SCALE, motion, type Theme } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { GLOW } from '../ui/glow';
import { GlowHalo } from '../ui/GlowHalo';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';
import type { PathEntry } from './path';
import { blockRadius, blockSize, dragShift, hitTest, PATH, project, sampleRange, zigzag, type Viewport } from './pathProjection';

const SIDE = PATH.side3d;
/** Finger travel before a touch counts as a drag rather than a tap. */
const DRAG_SLOP = 6;

const sizeOf = (e: PathEntry | undefined) => blockSize(e?.kind === 'trophy' ? 'trophy' : 'day');

/** Fill, ring and the thickness of the block's lower side. */
function tileStyle(e: PathEntry, t: Theme): ViewStyle {
  const dark = t.name === 'dark';
  if (e.kind === 'trophy') {
    if (e.state === 'got') return { backgroundColor: t.accentDeep, borderBottomWidth: SIDE, borderBottomColor: '#A8916A' };
    if (e.state === 'ready')
      return { backgroundColor: t.accent, borderWidth: 3, borderColor: t.accentLine, borderBottomWidth: SIDE, borderBottomColor: t.accentDeep, boxShadow: '0px 0px 26px 8px rgba(232, 213, 181, 0.9)' };
    return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)', borderWidth: 2, borderColor: t.accentLine };
  }
  switch (e.state) {
    case 'done':
      return { backgroundColor: t.accent, borderBottomWidth: SIDE, borderBottomColor: t.accentDeep, ...(e.isToday ? { borderWidth: 2, borderColor: t.accentLine, borderBottomWidth: SIDE } : null) };
    case 'today':
      return { backgroundColor: t.background[0], borderWidth: 3, borderColor: t.accentLine };
    case 'rest':
      return { backgroundColor: 'transparent', borderWidth: 3, borderColor: t.text.secondary };
    case 'past':
      return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)', borderBottomWidth: SIDE, borderBottomColor: 'rgba(120, 120, 110, 0.15)' };
    default:
      return { backgroundColor: dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.75)', borderBottomWidth: SIDE, borderBottomColor: 'rgba(120, 120, 110, 0.2)' };
  }
}

function Face({ e, t }: { e: PathEntry; t: Theme }) {
  const ink = e.kind === 'day' && e.state === 'done' ? t.onAccent : t.text.primary;
  if (e.kind === 'trophy') {
    return (
      <>
        <Icon name="award" size={18} color={t.onAccent} />
        <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.small, { color: t.onAccent }]}>
          {e.state === 'got' ? '+50' : e.state === 'ready' ? 'COLLECT' : 'WEEK'}
        </AppText>
      </>
    );
  }
  const top = e.state === 'done' ? null : e.state === 'today' ? 'TODAY' : e.state === 'rest' ? 'REST' : e.weekday.toUpperCase();
  return (
    <>
      {top ? (
        <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.small, { color: ink }]}>
          {top}
        </AppText>
      ) : (
        <Icon name="check" size={11} color={ink} />
      )}
      <AppText maxFontSizeMultiplier={DECOR_FONT_SCALE} style={[styles.num, { color: ink }]}>
        {e.day}
      </AppText>
    </>
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

/**
 * The streak as blocks on a path that recedes into the distance. It follows the finger: push it up to look back;
 * tap a block for that day. The 3D look is computed (see pathProjection.ts), so every block is
 * a flat view: taps land where the block is drawn, and nothing is rotated in 3D.
 */
export function StreakPath({ entries, focus, onTap, onDragChange }: StreakPathProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [view, setView] = useState<Viewport | null>(null);

  // The latest props for the gesture handlers, which are made once.
  const live = useRef({ entries, onTap, onDragChange, reduced, view });
  useLayoutEffect(() => {
    live.current = { entries, onTap, onDragChange, reduced, view };
  });
  const base = useRef(focus * PATH.step);
  const [shift] = useState(() => new Animated.Value(focus * PATH.step));
  /** The block under a finger or the mouse, which wears the halo. */
  const [glowIndex, setGlowIndex] = useState<number | null>(null);
  const blockAt = (x: number, y: number) => {
    const { view: v, entries: list } = live.current;
    if (!v) return null;
    return hitTest({ x, y }, { position: base.current / PATH.step, count: list.length, sizeOf: (k) => sizeOf(list[k]), view: v });
  };

  // The handlers read `live` and `base` only when a touch happens or focus changes, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [{ settle, pan }] = useState(() => {
    const move = (to: number) => {
      base.current = to;
      if (live.current.reduced) shift.setValue(to);
      else Animated.spring(shift, { toValue: to, useNativeDriver: true, ...motion.spring }).start();
    };
    const clamp = (v: number) => Math.max(0, Math.min((live.current.entries.length - 1) * PATH.step, v));
    let dragging = false;
    const responder = PanResponder.create({
      // Take the touch at once, so the page's scrolling can't claim it first on Android.
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        dragging = false;
        setGlowIndex(blockAt(e.nativeEvent.locationX, e.nativeEvent.locationY));
      },
      onPanResponderMove: (_, g) => {
        if (!dragging && Math.abs(g.dx) < DRAG_SLOP && Math.abs(g.dy) < DRAG_SLOP) return;
        if (!dragging) {
          dragging = true;
          setGlowIndex(null);
          live.current.onDragChange?.(true);
        }
        shift.setValue(clamp(dragShift(base.current, g.dy)));
      },
      onPanResponderRelease: (e, g) => {
        setGlowIndex(null);
        if (!dragging) {
          const i = blockAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (i !== null) live.current.onTap(i);
          return;
        }
        dragging = false;
        live.current.onDragChange?.(false);
        move(Math.round(clamp(dragShift(base.current, g.dy)) / PATH.step) * PATH.step);
      },
      onPanResponderTerminate: () => {
        setGlowIndex(null);
        if (!dragging) return;
        dragging = false;
        live.current.onDragChange?.(false);
        move(base.current);
      },
    });
    return { settle: move, pan: responder };
  });

  useEffect(() => {
    settle(focus * PATH.step);
  }, [focus, reduced, settle]);

  // One set of native-driver interpolations per block: where it sits, how big, how faded.
  const shape = entries.map((e) => e.kind).join(',');
  const motionStyles = useMemo(() => {
    if (!view) return [];
    const samples = sampleRange();
    return shape.split(',').map((kind, i) => {
      const size = blockSize(kind === 'trophy' ? 'trophy' : 'day');
      const faceH = size * PATH.faceRatio;
      const points = samples.map((rel) => project(rel, zigzag(i), view));
      const rel = Animated.subtract(i * PATH.step, shift);
      const along = (out: number[]) => rel.interpolate({ inputRange: samples, outputRange: out, extrapolate: 'clamp' });
      return {
        width: size,
        height: faceH + SIDE,
        opacity: along(points.map((p) => p.opacity)),
        transformOrigin: [size / 2, faceH / 2, 0],
        transform: [
          { translateX: along(points.map((p) => p.x - size / 2)) },
          { translateY: along(points.map((p) => p.y - faceH / 2)) },
          { scale: along(points.map((p) => p.scale)) },
        ],
      };
    });
  }, [shape, view, shift]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      // A mouse resting over a block lights it (web); touches light blocks through the pan handler.
      onPointerMove={(e) => {
        if (e.nativeEvent.pointerType !== 'mouse' || e.nativeEvent.buttons !== 0) return;
        const i = blockAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setGlowIndex((prev) => (prev === i ? prev : i));
      }}
      onPointerLeave={() => setGlowIndex(null)}
      {...pan.panHandlers}
    >
      {view
        ? // Draw far blocks first so nearer ones sit on top.
          entries
            .map((e, i) => ({ e, i }))
            .reverse()
            .map(({ e, i }) => {
              const style = motionStyles[i];
              if (!style) return null;
              const size = sizeOf(e);
              return (
                <Animated.View key={e.kind === 'day' ? e.date : `trophy-${e.weekStart}`} pointerEvents="none" style={[styles.tile, style]}>
                  {/* Touches go to the path's own handler; this stays for screen readers. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel(e)}
                    accessibilityHint="Shows that day"
                    onPress={() => onTap(i)}
                    style={[styles.face, { width: size, height: size * PATH.faceRatio + SIDE, borderRadius: blockRadius(size) }, tileStyle(e, theme)]}
                  >
                    <GlowHalo on={glowIndex === i} radius={blockRadius(size)} durationMs={glowIndex === i ? GLOW.pressInMs : GLOW.outMs} />
                    <Face e={e} t={theme} />
                  </Pressable>
                </Animated.View>
              );
            })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { position: 'absolute', left: 0, top: 0 },
  face: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  small: { fontSize: 10, lineHeight: 12, fontWeight: '600', letterSpacing: 0.2 },
  num: { fontSize: 19, lineHeight: 22, fontWeight: '600' },
});
