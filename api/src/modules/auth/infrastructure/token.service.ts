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
}
