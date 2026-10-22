import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The OS "reduce motion" preference (ADR-P035 D5), on iOS, Android and Web
 * (react-native-web reads `prefers-reduced-motion`).
 *
 * Returns `true` until the preference is known, so an animation never starts
 * and then stops for someone who turned motion off. It follows changes live.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      // Unknown preference: stay still, which is the accessible default.
      .catch(() => {
        if (active) setReduced(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) =>
      setReduced(value),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced ?? true;
}
