import * as SecureStore from 'expo-secure-store';

import {
  HEIGHT_UNIT_STORAGE_KEY,
  isHeightUnit,
  isUnitSystem,
  isWeightUnit,
  preferencesFromSystem,
  UNIT_SYSTEM_STORAGE_KEY,
  type HeightUnit,
  type UnitPreferences,
  type WeightUnit,
  WEIGHT_UNIT_STORAGE_KEY,
} from './units';

/**
 * The display-unit choices (not sensitive), kept beside the language
 * preference. v11-B: weight and height are stored apart; the v10 single choice
 * is migrated once (imperial → lb + ft-in) and then removed.
 */
export async function loadUnitPreferences(): Promise<UnitPreferences> {
  const [weight, height] = await Promise.all([
    SecureStore.getItemAsync(WEIGHT_UNIT_STORAGE_KEY),
    SecureStore.getItemAsync(HEIGHT_UNIT_STORAGE_KEY),
  ]);
  if (isWeightUnit(weight) && isHeightUnit(height)) return { weight, height };
  const legacy = await SecureStore.getItemAsync(UNIT_SYSTEM_STORAGE_KEY);
  const base = preferencesFromSystem(isUnitSystem(legacy) ? legacy : 'metric');
  const migrated: UnitPreferences = {
    weight: isWeightUnit(weight) ? weight : base.weight,
    height: isHeightUnit(height) ? height : base.height,
  };
  if (legacy !== null) {
    await SecureStore.setItemAsync(WEIGHT_UNIT_STORAGE_KEY, migrated.weight);
    await SecureStore.setItemAsync(HEIGHT_UNIT_STORAGE_KEY, migrated.height);
    await SecureStore.deleteItemAsync(UNIT_SYSTEM_STORAGE_KEY);
  }
  return migrated;
}

export async function saveWeightUnit(unit: WeightUnit): Promise<void> {
  await SecureStore.setItemAsync(WEIGHT_UNIT_STORAGE_KEY, unit);
}

export async function saveHeightUnit(unit: HeightUnit): Promise<void> {
  await SecureStore.setItemAsync(HEIGHT_UNIT_STORAGE_KEY, unit);
}
