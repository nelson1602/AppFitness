import { Role } from '@prisma/client';

/** JWT access token payload. */
export interface AccessTokenPayload {
  /** User id (UUID). */
  sub: string;
  role: Role;
}

/** Identity attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

/** Fields of a user that are safe to return to clients. */
export interface SafeUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  /**
   * When this address was verified, or null for legacy-unverified and
   * not-yet-verified accounts (ADR-P026 Decision 10).
   *
   * Exposed because the soft-gate reminder V2-D builds needs to know
   * verification state, and /auth/me is the only place a client learns about
   * its own account. It is the caller's own attribute — never another user's —
   * so this discloses nothing they cannot already infer.
   */
  emailVerifiedAt: Date | null;
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
