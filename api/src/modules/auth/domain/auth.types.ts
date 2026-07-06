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
}

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
