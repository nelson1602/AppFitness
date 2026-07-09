import { logError } from '@/shared/infrastructure/logging';

import type { Restriction, RestrictionInput } from '../domain/medical.types';
import { endRestriction, getMyActiveRestrictions, recordRestriction } from './medical.service';
import { useRestrictionStore } from './restriction.store';

jest.mock('./medical.service', () => ({
  getMyActiveRestrictions: jest.fn(),
  recordRestriction: jest.fn(),
  endRestriction: jest.fn(),
}));
jest.mock('@/shared/infrastructure/logging', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const mockGetActive = jest.mocked(getMyActiveRestrictions);
const mockRecord = jest.mocked(recordRestriction);
const mockEnd = jest.mocked(endRestriction);
const mockLogError = jest.mocked(logError);

const restriction: Restriction = {
  id: 'r1',
  userId: 'u1',
  type: 'INJURY',
  bodyArea: 'left knee',
  severity: 'MODERATE',
  notes: null,
  isActive: true,
  effectiveFrom: '2026-07-09',
  effectiveUntil: null,
  version: 1,
  syncStatus: 'pending',
};

const input: RestrictionInput = {
  type: 'INJURY',
  bodyArea: 'left knee',
  severity: 'MODERATE',
  notes: 'sensitive restriction note',
};

describe('restriction store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRestrictionStore.setState({ status: 'idle', restrictions: [], error: null });
  });

  it('loads active restrictions and transitions idle → ready', async () => {
    mockGetActive.mockResolvedValue([restriction]);

    await useRestrictionStore.getState().load();

    const state = useRestrictionStore.getState();
    expect(state.status).toBe('ready');
    expect(state.restrictions).toEqual([restriction]);
  });

  it('surfaces a safe error and logs (tag only) when load fails', async () => {
    mockGetActive.mockRejectedValue(new Error('sqlite is unavailable'));

    await useRestrictionStore.getState().load();

    expect(useRestrictionStore.getState().status).toBe('error');
    expect(useRestrictionStore.getState().error).toBe(
      'Your restrictions could not be loaded right now.',
    );
    expect(mockLogError).toHaveBeenCalledWith('restriction.load', expect.any(Error));
  });

  it('records a restriction and appends it to the active list', async () => {
    mockRecord.mockResolvedValue(restriction);

    const ok = await useRestrictionStore.getState().save(input);

    expect(ok).toBe(true);
    expect(mockRecord).toHaveBeenCalledWith(input);
    expect(useRestrictionStore.getState().restrictions).toEqual([restriction]);
    expect(useRestrictionStore.getState().status).toBe('ready');
  });

  it('never logs sensitive restriction notes on save failure', async () => {
    mockRecord.mockRejectedValue(new Error('encryption key missing'));

    const ok = await useRestrictionStore.getState().save(input);

    expect(ok).toBe(false);
    expect(useRestrictionStore.getState().error).toBe(
      'Your restriction could not be saved. Please try again.',
    );
    expect(mockLogError).toHaveBeenCalledWith('restriction.save', expect.any(Error));
    expect(JSON.stringify(mockLogError.mock.calls)).not.toContain('sensitive restriction note');
  });

  it('deactivates a restriction and refreshes the active list', async () => {
    useRestrictionStore.setState({ status: 'ready', restrictions: [restriction], error: null });
    mockEnd.mockResolvedValue(undefined);
    mockGetActive.mockResolvedValue([]);

    const ok = await useRestrictionStore.getState().deactivate('r1');

    expect(ok).toBe(true);
    expect(mockEnd).toHaveBeenCalledWith('r1');
    expect(useRestrictionStore.getState().restrictions).toEqual([]);
    expect(useRestrictionStore.getState().status).toBe('ready');
  });

  it('reports a safe error when deactivation fails', async () => {
    mockEnd.mockRejectedValue(new Error('db locked'));

    const ok = await useRestrictionStore.getState().deactivate('r1');

    expect(ok).toBe(false);
    expect(useRestrictionStore.getState().status).toBe('error');
    expect(mockLogError).toHaveBeenCalledWith('restriction.deactivate', expect.any(Error));
  });
});
