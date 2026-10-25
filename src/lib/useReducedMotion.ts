import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The one hook every animation checks (spec §10.6). True: no springs, loops or drifts. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
