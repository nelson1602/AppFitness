import { useEffect, useSyncExternalStore } from 'react';

import {
  getUnitSnapshot,
  initializeUnits,
  setHeightUnit,
  setWeightUnit,
  subscribeToUnits,
} from './unit-manager';
import { lengthSystemOf, weightSystemOf } from './units';

/**
 * The person's display units (v11-B: weight and height apart) and the setters.
 * `weightSystem` converts weights; `lengthSystem` converts heights and body
 * lengths.
 */
export function useUnits() {
  const current = useSyncExternalStore(subscribeToUnits, getUnitSnapshot, getUnitSnapshot);
  useEffect(() => {
    void initializeUnits();
  }, []);
  return {
    ...current,
    weightSystem: weightSystemOf(current.weight),
    lengthSystem: lengthSystemOf(current.height),
    setWeightUnit,
    setHeightUnit,
  };
}
