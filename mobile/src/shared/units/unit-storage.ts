import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_UNIT_SYSTEM,
  isUnitSystem,
  UNIT_SYSTEM_STORAGE_KEY,
  type UnitSystem,
} from './units';

/** The display-unit choice (not sensitive), kept beside the language preference. */
export async function loadUnitSystem(): Promise<UnitSystem> {
  const stored = await SecureStore.getItemAsync(UNIT_SYSTEM_STORAGE_KEY);
  return isUnitSystem(stored) ? stored : DEFAULT_UNIT_SYSTEM;
}

export async function saveUnitSystem(system: UnitSystem): Promise<void> {
  await SecureStore.setItemAsync(UNIT_SYSTEM_STORAGE_KEY, system);
}
