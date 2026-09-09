import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';
import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError, logWarn } from '@/shared/infrastructure/logging';

import type { WellnessSafetyProfile } from '../domain/wellness-safety-profile';
import { WellnessProfileInvalid } from '../domain/wellness-safety-profile.rules';
import {
  deleteMyWellnessSafetyProfile,
  getMyWellnessSafetyProfile,
  saveMyWellnessSafetyProfile,
} from './wellness-safety-profile.service';
import { getWellnessSafetyProfileSyncState } from './wellness-safety-profile.sync-state';
import { useWellnessSafetyProfileStore } from './wellness-safety-profile.store';

/**
 * ADR-P017 **W-3** store.
 *
 * A faithful in-memory session double (generation + owner comparison), so the
 * ADR-P030 C-1 publish guards are genuinely exercised rather than stubbed true.
 */

jest.mock('@/features/authentication', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
jest.mock('./wellness-safety-profile.service', () => ({
  deleteMyWellnessSafetyProfile: jest.fn(),
  getMyWellnessSafetyProfile: jest.fn(),
  saveMyWellnessSafetyProfile: jest.fn(),
}));
jest.mock('./wellness-safety-profile.sync-state', () => ({
  getWellnessSafetyProfileSyncState: jest.fn(),
}));

const auth = authModule as unknown as FakeSessionModule;
const mockGet = jest.mocked(getMyWellnessSafetyProfile);
const mockSave = jest.mocked(saveMyWellnessSafetyProfile);
const mockDelete = jest.mocked(deleteMyWellnessSafetyProfile);
const mockSync = jest.mocked(getWellnessSafetyProfileSyncState);
const mockLogError = jest.mocked(logError);
const mockLogWarn = jest.mocked(logWarn);

const INPUT = {
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee'],
  movementsToAvoid: ['jumping'],
};

const profile = (overrides: Partial<WellnessSafetyProfile> = {}): WellnessSafetyProfile => ({
  id: 'user-1',
  userId: 'user-1',
  evaluationCompleted: true,
  evaluationDate: '2026-01-02',
  affectedAreas: ['knee'],
  movementsToAvoid: ['jumping'],
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  version: 1,
  deletedAt: null,
  deletedBy: null,
  ...overrides,
});

const state = () => useWellnessSafetyProfileStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  auth.becomeUser('user-1');
  useWellnessSafetyProfileStore.setState({
    status: 'idle',
    profile: null,
    sync: 'synced',
    error: null,
    outcome: null,
  });
  mockGet.mockResolvedValue(null);
  mockSave.mockResolvedValue(profile());
  mockDelete.mockResolvedValue(true);
  mockSync.mockResolvedValue('synced');
});

describe('load', () => {
  it('publishes the stored profile and its sync state', async () => {
    mockGet.mockResolvedValue(profile());
    mockSync.mockResolvedValue('pending');

    await state().load();

    expect(state().status).toBe('ready');
    expect(state().profile?.affectedAreas).toEqual(['knee']);
    expect(state().sync).toBe('pending');
    expect(state().error).toBeNull();
  });

  it('reports Empty as a successful read, not an error', async () => {
    await state().load();

    expect(state().status).toBe('ready');
    expect(state().profile).toBeNull();
    expect(state().error).toBeNull();
  });

  it('renders the dormant Web database as its own state, with nothing to retry', async () => {
    mockGet.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await state().load();

    expect(state().status).toBe('web-unavailable');
    expect(state().profile).toBeNull();
    expect(state().error).toBeNull();
    // An expected platform boundary is not a runtime error.
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('maps a load failure to the load discriminant, never to prose', async () => {
    mockGet.mockRejectedValue(new Error('SQLITE_IOERR: disk I/O error'));

    await state().load();

    expect(state().status).toBe('error');
    expect(state().error).toBe('load');
    expect(mockLogError).toHaveBeenCalledWith('wellnessSafetyProfile.load', expect.any(Error));
  });

  it('refuses a corrupt stored row without repairing, deleting or overwriting it', async () => {
    mockGet.mockRejectedValue(new WellnessProfileInvalid('unknown-token', 'affected_areas'));

    await state().load();

    expect(state().status).toBe('error');
    expect(state().error).toBe('invalid');
    expect(state().profile).toBeNull();
    // The stored row is left exactly as it is.
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('logs no decoder reason, field or value for a refused row', async () => {
    mockGet.mockRejectedValue(new WellnessProfileInvalid('unknown-token', 'affected_areas'));

    await state().load();

    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
    const [scope, message, context] = mockLogWarn.mock.calls[0];
    expect(scope).toBe('wellnessSafetyProfile.load');
    expect(message).not.toContain('unknown-token');
    expect(message).not.toContain('affected_areas');
    expect(context).toBeUndefined();
  });

  it('does not publish onto another account after a mid-flight switch', async () => {
    let release = (): void => {};
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(profile());
        }),
    );

    const pending = state().load();
    auth.becomeUser('user-2');
    release();
    await pending;

    // The session binding reset the store to its initial shape on the switch;
    // the guard is what stops the late read from publishing over that reset.
    expect(state().profile).toBeNull();
    expect(state().status).toBe('idle');
  });

  it('rejects with no session, leaving the surface in its Error state', async () => {
    auth.endSession();

    await state().load();

    expect(state().status).toBe('error');
    expect(state().error).toBe('load');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('save', () => {
  it('stores through the W-2 boundary and confirms with the pending outcome', async () => {
    mockSync.mockResolvedValue('pending');

    await expect(state().save(INPUT, '2026-09-09')).resolves.toBe(true);

    expect(mockSave).toHaveBeenCalledWith(INPUT, '2026-09-09');
    expect(state().status).toBe('ready');
    expect(state().outcome).toBe('saved');
    expect(state().sync).toBe('pending');
    expect(state().profile?.evaluationDate).toBe('2026-01-02');
  });

  it('keeps the form usable after a save failure', async () => {
    mockSave.mockRejectedValue(new Error('SQLITE_FULL'));

    await expect(state().save(INPUT)).resolves.toBe(false);

    expect(state().status).toBe('ready');
    expect(state().error).toBe('save');
    expect(state().outcome).toBeNull();
    expect(mockLogError).toHaveBeenCalledWith('wellnessSafetyProfile.save', expect.any(Error));
  });

  it('separates a domain rejection from a transient failure', async () => {
    mockSave.mockRejectedValue(new WellnessProfileInvalid('date-in-the-future', 'evaluation_date'));

    await expect(state().save(INPUT)).resolves.toBe(false);

    expect(state().error).toBe('invalidInput');
    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockLogWarn.mock.calls[0][1]).not.toContain('date-in-the-future');
  });

  it('clears a previous outcome while the write is in flight', async () => {
    mockSync.mockResolvedValue('pending');
    await state().save(INPUT);
    expect(state().outcome).toBe('saved');

    let release = (): void => {};
    mockSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(profile());
        }),
    );
    const pending = state().save(INPUT);
    expect(state().status).toBe('saving');
    expect(state().outcome).toBeNull();
    release();
    await pending;
  });

  it('does not publish a save onto another account', async () => {
    let release = (): void => {};
    mockSave.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(profile());
        }),
    );

    const pending = state().save(INPUT);
    auth.becomeUser('user-2');
    release();

    await expect(pending).resolves.toBe(false);
    expect(state().profile).toBeNull();
  });

  it('falls into the Web state rather than reporting a save failure', async () => {
    mockSave.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await expect(state().save(INPUT)).resolves.toBe(false);

    expect(state().status).toBe('web-unavailable');
    expect(state().error).toBeNull();
    expect(mockLogError).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('clears the profile and confirms the removal', async () => {
    mockGet.mockResolvedValue(profile());
    await state().load();

    await expect(state().remove()).resolves.toBe(true);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(state().profile).toBeNull();
    expect(state().outcome).toBe('removed');
    expect(state().status).toBe('ready');
  });

  it('reports a removal failure without clearing what is stored', async () => {
    mockGet.mockResolvedValue(profile());
    await state().load();
    mockDelete.mockRejectedValue(new Error('SQLITE_BUSY'));

    await expect(state().remove()).resolves.toBe(false);

    expect(state().error).toBe('remove');
    expect(state().profile?.id).toBe('user-1');
    expect(mockLogError).toHaveBeenCalledWith('wellnessSafetyProfile.remove', expect.any(Error));
  });

  it('falls into the Web state rather than reporting a removal failure', async () => {
    mockDelete.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    await expect(state().remove()).resolves.toBe(false);

    expect(state().status).toBe('web-unavailable');
    expect(state().error).toBeNull();
    expect(mockLogError).not.toHaveBeenCalled();
  });
});

describe('account scoping', () => {
  it('drops the cached profile when the account changes', async () => {
    mockGet.mockResolvedValue(profile());
    await state().load();
    expect(state().profile).not.toBeNull();

    auth.becomeUser('user-2');

    expect(state().profile).toBeNull();
    expect(state().status).toBe('idle');
    expect(state().outcome).toBeNull();
  });

  it('drops it on sign-out too', async () => {
    mockGet.mockResolvedValue(profile());
    await state().load();

    auth.endSession();

    expect(state().profile).toBeNull();
    expect(state().status).toBe('idle');
  });
});
