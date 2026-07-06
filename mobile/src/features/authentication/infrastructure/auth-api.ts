import type { AuthUser, SessionTokens } from '../domain/session.types';

/**
 * Minimal fetch client for the NestJS auth endpoints. The base URL comes
 * from EXPO_PUBLIC_API_URL (inlined by Expo at build time); defaults to
 * the local api/ dev server.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export class AuthApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

interface AuthResponse extends SessionTokens {
  user: AuthUser;
}

async function post<T>(path: string, body: unknown, expectBody = true): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new AuthApiError(response.status, await safeErrorMessage(response));
  }
  return expectBody ? ((await response.json()) as T) : (undefined as T);
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    return message ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function register(input: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/register', input);
}

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/login', input);
}

export function refresh(refreshToken: string): Promise<SessionTokens> {
  return post<SessionTokens>('/auth/refresh', { refreshToken });
}

export function logout(refreshToken: string): Promise<void> {
  return post<void>('/auth/logout', { refreshToken }, false);
}

export async function me(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new AuthApiError(response.status, await safeErrorMessage(response));
  }
  return (await response.json()) as AuthUser;
}
