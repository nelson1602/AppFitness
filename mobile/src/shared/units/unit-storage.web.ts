import { logError } from '@/shared/infrastructure/logging/logger';

import {
  DEFAULT_HEIGHT_UNIT,
  DEFAULT_WEIGHT_UNIT,
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
 * Web display-unit storage. Like the language preference (ADR-P018), only these
 * non-sensitive UI choices are kept in `localStorage`; missing, blocked or
 * throwing storage falls back to kg / cm and never breaks the app. v11-B:
 * weight and height apart, the v10 single choice migrated once.
 */
function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (error) {
    logError('units.storage.web.unavailable', error);
    return null;
  }
}

const DEFAULTS: UnitPreferences = { weight: DEFAULT_WEIGHT_UNIT, height: DEFAULT_HEIGHT_UNIT };

export async function loadUnitPreferences(): Promise<UnitPreferences> {
  const storage = getLocalStorage();
  if (!storage) return DEFAULTS;
  try {
    const weight = storage.getItem(WEIGHT_UNIT_STORAGE_KEY);
    const height = storage.getItem(HEIGHT_UNIT_STORAGE_KEY);
    if (isWeightUnit(weight) && isHeightUnit(height)) return { weight, height };
    const legacy = storage.getItem(UNIT_SYSTEM_STORAGE_KEY);
    const base = preferencesFromSystem(isUnitSystem(legacy) ? legacy : 'metric');
    const migrated: UnitPreferences = {
      weight: isWeightUnit(weight) ? weight : base.weight,
      height: isHeightUnit(height) ? height : base.height,
    };
    if (legacy !== null) {
      storage.setItem(WEIGHT_UNIT_STORAGE_KEY, migrated.weight);
      storage.setItem(HEIGHT_UNIT_STORAGE_KEY, migrated.height);
      storage.removeItem(UNIT_SYSTEM_STORAGE_KEY);
    }
    return migrated;
  } catch (error) {
    logError('units.storage.web.load', error);
    return DEFAULTS;
  }
}

function save(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch (error) {
    // Best effort on Web: the in-memory choice still applies.
    logError('units.storage.web.save', error);
  }
}

export async function saveWeightUnit(unit: WeightUnit): Promise<void> {
  save(WEIGHT_UNIT_STORAGE_KEY, unit);
}

export async function saveHeightUnit(unit: HeightUnit): Promise<void> {
  save(HEIGHT_UNIT_STORAGE_KEY, unit);
}
