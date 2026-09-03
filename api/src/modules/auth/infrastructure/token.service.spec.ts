import { createHash } from 'crypto';

import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';

import {
  PASSWORD_RESET_TTL_MINUTES,
  TokenService,
  msFromExpiry,
} from './token.service';

/**
 * Password-reset token generation (ADR-P026 Decision 6). The storage
 * guarantee — hash only, never the raw value — starts here, so the shape and
 * the hash are asserted directly rather than inferred from the flow.
 */
describe('TokenService password-reset tokens', () => {
  const service = new TokenService(
    {} as unknown as JwtService,
    { get: () => undefined } as unknown as ConfigService,
  );

  it('produces a 32-byte base64url value with its SHA-256 hash', () => {
    const { raw, hash } = service.generatePasswordResetToken();

    // 32 bytes base64url-encoded, unpadded.
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(raw, 'base64url')).toHaveLength(32);
    expect(hash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // The hash must not reveal the raw token.
    expect(hash).not.toContain(raw);
  });

  it('never repeats a token across issuances', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(service.generatePasswordResetToken().raw);
    }
    expect(seen.size).toBe(200);
  });

  it('hashes deterministically so a presented token can be looked up', () => {
    const { raw, hash } = service.generatePasswordResetToken();

    expect(service.hashPasswordResetToken(raw)).toBe(hash);
    expect(service.hashPasswordResetToken(`${raw}x`)).not.toBe(hash);
  });

  it('fixes the lifetime at 30 minutes, independent of configuration', () => {
    expect(PASSWORD_RESET_TTL_MINUTES).toBe(30);
    expect(service.passwordResetTtlMs()).toBe(30 * 60_000);
  });
});

describe('msFromExpiry', () => {
  it.each([
    ['15m', 900_000],
    ['7d', 604_800_000],
    ['30s', 30_000],
    ['2h', 7_200_000],
  ])('parses %s', (expiry, expected) => {
    expect(msFromExpiry(expiry)).toBe(expected);
  });

  it('falls back to 7 days on malformed input', () => {
    expect(msFromExpiry('nonsense')).toBe(7 * 86_400_000);
  });
});

/**
 * Email-verification token generation (ADR-P026 Decision 6, V2-C). Asserted
 * directly rather than through the flow, for the same reason the reset-token
 * suite above is: the hash-only storage guarantee starts here.
 */
describe('TokenService email-verification tokens', () => {
  const service = new TokenService(
    {} as unknown as JwtService,
    { get: () => undefined } as unknown as ConfigService,
  );

  it('produces a 32-byte base64url value with its SHA-256 hash', () => {
    const { raw, hash } = service.generateEmailVerificationToken();

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(raw, 'base64url')).toHaveLength(32);
    expect(hash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(hash).not.toContain(raw);
  });

  it('hashes deterministically and distinguishes different inputs', () => {
    expect(service.hashEmailVerificationToken('abc')).toBe(
      service.hashEmailVerificationToken('abc'),
    );
    expect(service.hashEmailVerificationToken('abc')).not.toBe(
      service.hashEmailVerificationToken('abd'),
    );
  });

  it('never repeats a token across issuances', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(service.generateEmailVerificationToken().raw);
    }
    expect(seen.size).toBe(200);
  });

  it('fixes the TTL at 24 hours — far longer than a reset token', () => {
    expect(service.emailVerificationTtlMs()).toBe(24 * 60 * 60 * 1000);
    expect(service.emailVerificationTtlMs()).toBeGreaterThan(
      service.passwordResetTtlMs(),
    );
  });
});
