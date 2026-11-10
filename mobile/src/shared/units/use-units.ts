import { useEffect, useSyncExternalStore } from 'react';

import { getUnitSnapshot, initializeUnits, setUnitSystem, subscribeToUnits } from './unit-manager';

/** The person's display units (metric or imperial) and the setter. */
export function useUnits() {
  const current = useSyncExternalStore(subscribeToUnits, getUnitSnapshot, getUnitSnapshot);
  useEffect(() => {
    void initializeUnits();
  }, []);
  return { ...current, setUnitSystem };
}
