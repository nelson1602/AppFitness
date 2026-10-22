import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { fromBase64, toBase64 } from '../../../shared/infrastructure/crypto/field-cipher';
import { logError } from '../../../shared/infrastructure/logging';

/**
 * The biometric unlock key (ADR-P036 Amendment A).
 *
 * A random 256-bit key lives in SecureStore with `requireAuthentication`, so
 * only the device's biometric hardware can release it. It seals the stored
 * session; the app holds it in memory while open. No biometric data is ever
 * read by the app: the OS performs the check and either releases the key or not.
 *
 * The link marker beside it is **not** secret — just which account is linked.
 */
const UNLOCK_KEY = 'auth.biometric.key.v1';
const LINK_KEY = 'auth.biometric.link.v1';
const KEY_BYTES = 32;

export type KeyRead =
  | { status: 'released'; key: Uint8Array }
  /** The OS invalidated the key (biometric enrolment changed) or it is gone. */
  | { status: 'invalidated' }
  /** Cancelled, failed, locked out or otherwise not released this time. */
  | { status: 'failed' };

function protectedOptions(prompt: string): SecureStore.SecureStoreOptions {
  return { requireAuthentication: true, authenticationPrompt: prompt };
}

/**
 * Creates and stores a new unlock key. Returns it, or `null` if the user did
 * not authenticate. Android asks for biometrics on the write itself; iOS does
 * not prompt when an item is created, so the key is read back once there to
 * confirm that the person linking can actually unlock it.
 */
export async function createUnlockKey(prompt: string): Promise<Uint8Array | null> {
  const key = await Crypto.getRandomBytesAsync(KEY_BYTES);
  try {
    await SecureStore.setItemAsync(UNLOCK_KEY, toBase64(key), protectedOptions(prompt));
  } catch (error) {
    logError('auth.biometric.createKey', error);
    await deleteUnlockKey();
    return null;
  }
  if (Platform.OS === 'ios') {
    const confirmed = await readUnlockKey(prompt);
    if (confirmed.status !== 'released') {
      await deleteUnlockKey();
      return null;
    }
  }
  return key;
}

/** Asks the OS to release the key; the biometric prompt shows here. */
export async function readUnlockKey(prompt: string): Promise<KeyRead> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(UNLOCK_KEY, protectedOptions(prompt));
  } catch (error) {
    logError('auth.biometric.readKey', error);
    return { status: 'failed' };
  }
  if (stored === null) return { status: 'invalidated' };
  try {
    const key = fromBase64(stored);
    return key.length === KEY_BYTES ? { status: 'released', key } : { status: 'invalidated' };
  } catch {
    return { status: 'invalidated' };
  }
}

export async function deleteUnlockKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(UNLOCK_KEY);
  } catch (error) {
    logError('auth.biometric.deleteKey', error);
  }
}

/** The linked account id, or `null`. Reading it never prompts. */
export async function readLinkedUserId(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(LINK_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const userId = (parsed as { v?: unknown; userId?: unknown } | null)?.userId;
    return (parsed as { v?: unknown }).v === 1 && typeof userId === 'string' && userId.length > 0
      ? userId
      : null;
  } catch (error) {
    logError('auth.biometric.readLink', error);
    return null;
  }
}

export async function writeLink(userId: string): Promise<void> {
  await SecureStore.setItemAsync(LINK_KEY, JSON.stringify({ v: 1, userId }));
}

export async function deleteLink(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LINK_KEY);
  } catch (error) {
    logError('auth.biometric.deleteLink', error);
  }
}
