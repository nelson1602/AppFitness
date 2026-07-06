import * as SecureStore from 'expo-secure-store';

import type { AuthUser, Session, SessionTokens } from '../domain/session.types';

/**
 * Session persistence — SecureStore ONLY (.ai/05_SECURITY.md).
 * Tokens never touch SQLite, AsyncStorage, or plain files.
 */

const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  user: 'auth.user',
} as const;

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, session.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, session.refreshToken),
    SecureStore.setItemAsync(KEYS.user, JSON.stringify(session.user)),
  ]);
}

export async function saveTokens(tokens: SessionTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken),
  ]);
}

export async function loadSession(): Promise<Session | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.user),
  ]);
  if (!accessToken || !refreshToken || !userJson) return null;

  try {
    return { accessToken, refreshToken, user: JSON.parse(userJson) as AuthUser };
  } catch {
    await clearSession(); // corrupted entry — never half-restore a session
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    SecureStore.deleteItemAsync(KEYS.user),
  ]);
}
