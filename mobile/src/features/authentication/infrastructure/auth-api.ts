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

export async function deleteAccount(accessToken: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new AuthApiError(response.status, await safeErrorMessage(response));
  }
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

/**
 * Request a password-reset email (ADR-P026 Vertical 1).
 *
 * The server always answers 202 with the same body whether or not the account
 * exists, so there is nothing here worth reading — the response body is
 * deliberately discarded. `locale` selects the language of the email.
 */
export function requestPasswordReset(input: { email: string; locale: string }): Promise<void> {
  return post<void>('/auth/forgot-password', input, false);
}

/** Redeem a reset token from an emailed link and set a new password (204). */
export function resetPassword(input: { token: string; password: string }): Promise<void> {
  return post<void>('/auth/reset-password', input, false);
}

/**
 * Redeem a verification token from an emailed link (ADR-P026 Vertical 2).
 *
 * Public and session-agnostic: the link may be opened on any device, with or
 * without a session. Answers 204 and — by contract — returns no tokens and
 * establishes no session; the caller must not treat it as an authentication.
 */
export function verifyEmail(input: { token: string }): Promise<void> {
  return post<void>('/auth/verify-email', input, false);
}

/**
 * Ask the server to resend the verification email for the AUTHENTICATED user.
 *
 * Deliberately sends **no email address** — the endpoint acts on the account
 * behind the bearer token (ADR-P026 §Clarifications, 2026-09-03), which is what
 * removes the enumeration surface. Answers the same generic 202 for every
 * accepted request, so there is nothing in the body worth reading.
 */
export async function resendVerification(
  accessToken: string,
  input: { locale: string },
): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new AuthApiError(response.status, await safeErrorMessage(response));
  }
}
