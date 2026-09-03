export type Role = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  /**
   * ISO timestamp of when this address was verified, or null when it is not
   * (ADR-P026 Decision 10 — legacy accounts backfill to null and are never
   * locked out). Supplied by `GET /auth/me`, `register` and `login`.
   *
   * Optional on the wire so a session persisted by an older build still
   * restores: an absent value is read as "not verified", which is the safe
   * default — it shows the advisory reminder rather than hiding it.
   */
  emailVerifiedAt?: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session extends SessionTokens {
  user: AuthUser;
}

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated';
