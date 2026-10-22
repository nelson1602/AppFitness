import type { AuthUser, Session } from '../domain/session.types';
import { getBiometricCapability } from './biometric-capability.web';
import {
  createUnlockKey,
  deleteLink,
  deleteUnlockKey,
  readLinkedUserId,
  readUnlockKey,
  writeLink,
} from './biometric-vault.web';
import {
  deleteSealedSession,
  hasSealedSession,
  loadSealedSession,
  loadSession,
  saveSealedSession,
} from './session-storage.web';

/**
 * ADR-P036 on Web: biometric sign-in does not exist (ADR-P018 — Web sessions
 * are memory-only). Every Web form reports "nothing linked, nothing sealed" so
 * the shared session manager can never enter the `locked` state there.
 */
const user: AuthUser = {
  id: 'user-1',
  email: 'demo@appfitness.local',
  username: 'demo',
  role: 'USER',
  phone: null,
  avatarUrl: null,
};
const session: Session = { accessToken: 'a', refreshToken: 'r', user };

describe('biometric Web forms (ADR-P036, ADR-P018)', () => {
  it('reports biometrics as unavailable', async () => {
    await expect(getBiometricCapability()).resolves.toEqual({
      available: false,
      kind: 'fingerprint',
    });
  });

  it('never creates, releases or records a key or link', async () => {
    await expect(createUnlockKey()).resolves.toBeNull();
    await expect(readUnlockKey()).resolves.toEqual({ status: 'invalidated' });
    await expect(readLinkedUserId()).resolves.toBeNull();
    await expect(writeLink()).resolves.toBeUndefined();
    await expect(deleteLink()).resolves.toBeUndefined();
    await expect(deleteUnlockKey()).resolves.toBeUndefined();
  });

  it('never holds a sealed session; a "sealed" save stays in memory like any other', async () => {
    await saveSealedSession(session);
    await expect(loadSession()).resolves.toEqual(session);
    await expect(hasSealedSession()).resolves.toBe(false);
    await expect(loadSealedSession()).resolves.toBeNull();
    await expect(deleteSealedSession()).resolves.toBeUndefined();
  });
});
