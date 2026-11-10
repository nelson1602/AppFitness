import { logError } from '@/shared/infrastructure/logging/logger';

import { loadUnitSystem, saveUnitSystem } from './unit-storage';
import { DEFAULT_UNIT_SYSTEM, type UnitSystem } from './units';

export interface UnitSnapshot {
  system: UnitSystem;
  status: 'loading' | 'ready';
}

let state: UnitSnapshot = { system: DEFAULT_UNIT_SYSTEM, status: 'loading' };
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

/** Loads the stored choice once; a failure keeps metric, logged, never thrown. */
export function initializeUnits(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    let system: UnitSystem = DEFAULT_UNIT_SYSTEM;
    try {
      system = await loadUnitSystem();
    } catch (error) {
      logError('units.initialize', error);
    }
    publish({ system, status: 'ready' });
  })();
  return initialization;
}

/** Saves the choice; every screen showing a weight or length re-renders at once. */
export async function setUnitSystem(system: UnitSystem): Promise<void> {
  await saveUnitSystem(system);
  publish({ system, status: 'ready' });
}

/** Test seam: back to the first-launch state. */
export function resetUnitsForTests(): void {
  initialization = null;
  state = { system: DEFAULT_UNIT_SYSTEM, status: 'loading' };
  listeners.clear();
}
