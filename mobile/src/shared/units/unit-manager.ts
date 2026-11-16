import { logError } from '@/shared/infrastructure/logging/logger';

import { loadUnitPreferences, saveHeightUnit, saveWeightUnit } from './unit-storage';
import {
  DEFAULT_HEIGHT_UNIT,
  DEFAULT_WEIGHT_UNIT,
  type HeightUnit,
  type UnitPreferences,
  type WeightUnit,
} from './units';

export interface UnitSnapshot extends UnitPreferences {
  status: 'loading' | 'ready';
}

const FIRST: UnitSnapshot = {
  weight: DEFAULT_WEIGHT_UNIT,
  height: DEFAULT_HEIGHT_UNIT,
  status: 'loading',
};

let state: UnitSnapshot = FIRST;
let initialization: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: UnitSnapshot): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getUnitSnapshot(): UnitSnapshot {
  return state;
}

export function subscribeToUnits(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads the stored choices once; a failure keeps kg / cm, logged, never thrown. */
export function initializeUnits(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    let preferences: UnitPreferences = { weight: DEFAULT_WEIGHT_UNIT, height: DEFAULT_HEIGHT_UNIT };
    try {
      preferences = await loadUnitPreferences();
    } catch (error) {
      logError('units.initialize', error);
    }
    // A choice made while loading wins over what was stored.
    publish(state.status === 'ready' ? state : { ...preferences, status: 'ready' });
  })();
  return initialization;
}

/** Saves the weight unit; every screen showing a weight re-renders at once. */
export async function setWeightUnit(weight: WeightUnit): Promise<void> {
  await saveWeightUnit(weight);
  publish({ ...state, weight, status: 'ready' });
}

/** Saves the height unit (body lengths follow it); screens re-render at once. */
export async function setHeightUnit(height: HeightUnit): Promise<void> {
  await saveHeightUnit(height);
  publish({ ...state, height, status: 'ready' });
}

/** Test seam: back to the first-launch state. */
export function resetUnitsForTests(): void {
  initialization = null;
  state = FIRST;
  listeners.clear();
}
