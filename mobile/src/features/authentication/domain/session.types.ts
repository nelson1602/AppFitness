export type Role = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Session extends SessionTokens {
  user: AuthUser;
}

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated';
