import { createHash, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

import { AccessTokenPayload } from '../domain/auth.types';

const EXPIRY_UNITS_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Reset-token entropy: 32 bytes, base64url-encoded (ADR-P026 Decision 6). */
const PASSWORD_RESET_TOKEN_BYTES = 32;

/** Reset-token lifetime. Short by design: it is a password-equivalent credential. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** Parses "15m" / "7d" style durations; defaults to 7 days on bad input. */
export function msFromExpiry(expiry: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiry);
  if (!match) return 7 * 86_400_000;
  return parseInt(match[1], 10) * EXPIRY_UNITS_MS[match[2]];
}

/**
 * Access tokens: short-lived JWTs. Refresh tokens: opaque random values —
 * the raw token goes only to the client; the server stores a SHA-256 hash
 * (a database leak exposes no usable refresh tokens).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(userId: string, role: Role): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, role };
    return this.jwt.signAsync(payload);
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token);
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshTokenTtlMs(): number {
    return msFromExpiry(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
  }

  /**
   * Password-reset token (ADR-P026 Decision 6): a 32-byte random value in
   * base64url. Same shape as the refresh token — the raw value travels only
   * in the emailed link, and only the hash is persisted.
   */
  generatePasswordResetToken(): { raw: string; hash: string } {
    const raw = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
    return { raw, hash: this.hashPasswordResetToken(raw) };
  }

  /**
   * SHA-256 of a raw reset token. Deliberately a distinct method from
   * `hashRefreshToken` even though the algorithm matches: the two token
   * families must never be interchangeable at a call site, and a future
   * change to one must not silently alter the other.
   */
  hashPasswordResetToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Fixed 30-minute lifetime — deliberately not configurable (ADR-P026). */
  passwordResetTtlMs(): number {
    return PASSWORD_RESET_TTL_MINUTES * 60_000;
  }
}
