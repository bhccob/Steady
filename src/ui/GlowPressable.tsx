import { useRef, useState } from 'react';
import { Platform, Pressable, type PressableProps } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { focusShowsGlow, glowTarget, type GlowCause } from './glow';
import { GlowHalo } from './GlowHalo';

type GlowPressableProps = PressableProps & {
  /** Corner radius of the halo; match the pressable's own. */
  radius: number;
};

/**
 * A Pressable that wears the warm halo while pointed at (web), pressed (phone) or focused by
 * keyboard, and lifts a pixel on hover. Everything else behaves exactly like Pressable.
 */
export function GlowPressable({
  radius,
  style,
  children,
  accessibilityLabel,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  ...rest
}: GlowPressableProps) {
  const reduced = useReducedMotion();
  const active = useRef(new Set<GlowCause>());
  const [target, setTarget] = useState(() => glowTarget(new Set(), 'hover', reduced));

  const update = (cause: GlowCause, on: boolean) => {
    if (on) active.current.add(cause);
    else active.current.delete(cause);
    setTarget(glowTarget(active.current, cause, reduced));
  };

  return (
    <Pressable
      {...rest}
      accessibilityLabel={accessibilityLabel}
      onPressIn={(e) => {
        update('press', true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        update('press', false);
        onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        update('hover', true);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        update('hover', false);
        onHoverOut?.(e);
      }}
      onFocus={(e) => {
        if (focusShowsGlow(Platform.OS, (e.nativeEvent as unknown as { target?: Element } | undefined)?.target ?? null)) update('focus', true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        update('focus', false);
        onBlur?.(e);
      }}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        target.lift > 0 && !state.pressed ? { transform: [{ translateY: -target.lift }] } : null,
      ]}
    >
      {(state) => (
        <>
          <GlowHalo on={target.opacity === 1} radius={radius} durationMs={target.durationMs} />
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </Pressable>
  );
}
