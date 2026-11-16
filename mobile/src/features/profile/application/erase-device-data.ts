import { getSessionSnapshot, signOut } from '@/features/authentication';
import { countByStatus } from '@/shared/infrastructure/sync';

/**
 * "Borrar datos de este teléfono" (ADR-P047 D4).
 *
 * How many local changes have not reached the server yet. Applied operations
 * leave the outbox, so every row still in it is unsynced work that erasing
 * the phone would lose. Null when nobody is signed in or the count fails.
 */
export async function countUnsyncedChanges(): Promise<number | null> {
  const owner = getSessionSnapshot();
  if (!owner) return null;
  try {
    const counts = await countByStatus(owner.userId);
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  } catch {
    return null;
  }
}

/** Sign out and erase this phone's database and field key. */
export function signOutAndEraseThisPhone(): Promise<void> {
  return signOut({ eraseDeviceData: true });
}
