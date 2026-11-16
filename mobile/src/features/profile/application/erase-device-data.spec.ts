import { getSessionSnapshot, signOut } from '@/features/authentication';
import { countByStatus } from '@/shared/infrastructure/sync';

import { countUnsyncedChanges, signOutAndEraseThisPhone } from './erase-device-data';

jest.mock('@/features/authentication', () => ({
  getSessionSnapshot: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@/shared/infrastructure/sync', () => ({ countByStatus: jest.fn() }));

const mockSnapshot = jest.mocked(getSessionSnapshot);
const mockCount = jest.mocked(countByStatus);

/** ADR-P047 D4. */
describe('erase-device-data', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts every queued operation of the signed-in account as unsynced', async () => {
    mockSnapshot.mockReturnValue({ userId: 'user-1' } as ReturnType<typeof getSessionSnapshot>);
    mockCount.mockResolvedValue({ PENDING: 2, FAILED: 1, IN_FLIGHT: 1 });

    await expect(countUnsyncedChanges()).resolves.toBe(4);
    expect(mockCount).toHaveBeenCalledWith('user-1');
  });

  it('is null without a session or when the count fails', async () => {
    mockSnapshot.mockReturnValue(null);
    await expect(countUnsyncedChanges()).resolves.toBeNull();
    expect(mockCount).not.toHaveBeenCalled();

    mockSnapshot.mockReturnValue({ userId: 'user-1' } as ReturnType<typeof getSessionSnapshot>);
    mockCount.mockRejectedValue(new Error('database closed'));
    await expect(countUnsyncedChanges()).resolves.toBeNull();
  });

  it('erasing this phone is a sign-out that also erases device data', async () => {
    jest.mocked(signOut).mockResolvedValue(undefined);

    await signOutAndEraseThisPhone();

    expect(signOut).toHaveBeenCalledWith({ eraseDeviceData: true });
  });
});
