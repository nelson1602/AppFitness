import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether a screen reader is running (ADR-P039 D5), following changes live.
 *
 * Returns `true` until the answer is known, the same cautious default as
 * `useReducedMotion`: anything timed waits until it is safe to start.
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        if (active) setEnabled(true);
      });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (value) =>
      setEnabled(value),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled ?? true;
}
