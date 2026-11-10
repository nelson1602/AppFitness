import { logError } from '@/shared/infrastructure/logging/logger';

import {
  DEFAULT_UNIT_SYSTEM,
  isUnitSystem,
  UNIT_SYSTEM_STORAGE_KEY,
  type UnitSystem,
} from './units';

/**
 * Web display-unit storage. Like the language preference (ADR-P018), only this
 * non-sensitive UI choice is kept in `localStorage`; missing, blocked or
 * throwing storage falls back to metric and never breaks the app.
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

export async function loadUnitSystem(): Promise<UnitSystem> {
  const storage = getLocalStorage();
  if (!storage) return DEFAULT_UNIT_SYSTEM;
  try {
    const stored = storage.getItem(UNIT_SYSTEM_STORAGE_KEY);
    return isUnitSystem(stored) ? stored : DEFAULT_UNIT_SYSTEM;
  } catch (error) {
    logError('units.storage.web.load', error);
    return DEFAULT_UNIT_SYSTEM;
  }
}

export async function saveUnitSystem(system: UnitSystem): Promise<void> {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(UNIT_SYSTEM_STORAGE_KEY, system);
  } catch (error) {
    // Best effort on Web: the in-memory choice still applies.
    logError('units.storage.web.save', error);
  }
}
