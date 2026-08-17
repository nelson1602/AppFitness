import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import type { DietaryPreference } from '../domain/dietary-preference';
import {
  addDietaryPreference,
  getMyDietaryPreferences,
  removeDietaryPreference,
} from './dietary-preference.service';
import { useDietaryPreferenceStore } from './dietary-preference.store';

jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
jest.mock('./dietary-preference.service', () => ({
  addDietaryPreference: jest.fn(),
  getMyDietaryPreferences: jest.fn(),
  removeDietaryPreference: jest.fn(),
}));

const mockAdd = jest.mocked(addDietaryPreference);
const mockList = jest.mocked(getMyDietaryPreferences);
const mockRemove = jest.mocked(removeDietaryPreference);

const pref = (overrides: Partial<DietaryPreference> = {}): DietaryPreference => ({
  id: 'dp-1',
  userId: 'user-1',
  exclusionType: 'avoid_tag',
  avoidTag: 'nut_allergy',
  catalogKey: null,
  kind: 'allergy',
  hasNote: false,
  version: 1,
  syncStatus: 'pending',
  updatedAt: '2026-07-16T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useDietaryPreferenceStore.setState({ status: 'idle', preferences: [], error: null });
});

describe('useDietaryPreferenceStore', () => {
  it('load fetches and marks ready', async () => {
    mockList.mockResolvedValue([pref()]);
    await useDietaryPreferenceStore.getState().load();
    const s = useDietaryPreferenceStore.getState();
    expect(s.status).toBe('ready');
    expect(s.preferences).toHaveLength(1);
  });

  it('add appends the new preference on success', async () => {
    mockAdd.mockResolvedValue(pref({ id: 'dp-2' }));
    const ok = await useDietaryPreferenceStore
      .getState()
      .add({ exclusionType: 'avoid_tag', avoidTag: 'nut_allergy', kind: 'allergy' });
    expect(ok).toBe(true);
    expect(useDietaryPreferenceStore.getState().preferences.map((p) => p.id)).toEqual(['dp-2']);
  });

  it('remove reloads the list', async () => {
    mockRemove.mockResolvedValue(undefined);
    mockList.mockResolvedValue([]);
    const ok = await useDietaryPreferenceStore.getState().remove('dp-1');
    expect(ok).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith('dp-1');
    expect(useDietaryPreferenceStore.getState().status).toBe('ready');
  });

  it('surfaces a safe error without leaking values on failure', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    await useDietaryPreferenceStore.getState().load();
    const s = useDietaryPreferenceStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/could not be loaded/);
    // A genuine failure is still logged (unchanged behavior).
    expect(jest.mocked(logError)).toHaveBeenCalledWith('dietaryPreference.load', expect.any(Error));
  });

  it('maps the dormant Web database error to a distinct web-unavailable state (ADR-P019)', async () => {
    useDietaryPreferenceStore.setState({ status: 'ready', preferences: [pref()], error: null });
    mockList.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await useDietaryPreferenceStore.getState().load();

    const s = useDietaryPreferenceStore.getState();
    // Distinct, expected state — not a generic error.
    expect(s.status).toBe('web-unavailable');
    expect(s.error).toBeNull();
    // No fabricated exclusions left behind.
    expect(s.preferences).toEqual([]);
    // Expected Web dormancy is not logged as a runtime error.
    expect(jest.mocked(logError)).not.toHaveBeenCalled();
  });

  it('add returns false and surfaces a safe error when the save fails', async () => {
    mockAdd.mockRejectedValue(new Error('boom'));
    const ok = await useDietaryPreferenceStore
      .getState()
      .add({ exclusionType: 'avoid_tag', avoidTag: 'nut_allergy', kind: 'allergy' });
    const s = useDietaryPreferenceStore.getState();
    expect(ok).toBe(false);
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/could not be saved/);
    // The failed entry is not appended to the list.
    expect(s.preferences).toEqual([]);
  });

  it('remove returns false and surfaces a safe error when the delete fails', async () => {
    useDietaryPreferenceStore.setState({ preferences: [pref()] });
    mockRemove.mockRejectedValue(new Error('boom'));
    const ok = await useDietaryPreferenceStore.getState().remove('dp-1');
    const s = useDietaryPreferenceStore.getState();
    expect(ok).toBe(false);
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/could not be removed/);
  });
});
