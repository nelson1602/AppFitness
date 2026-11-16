import { MIN_JWT_SECRET_BYTES, resolveJwtSecret } from './auth.module';

const DEV_ONLY_FALLBACK_SECRET =
  'dev-only-jwt-secret-never-use-in-production-0001';
const REAL_SECRET = 'a-real-configured-access-secret-value-0001';

describe('resolveJwtSecret (JWT_ACCESS_SECRET fail-closed config, C-2)', () => {
  it('returns the configured secret verbatim regardless of NODE_ENV', () => {
    for (const nodeEnv of [
      'development',
      'test',
      'production',
      'staging',
      'preview',
      'weird-value',
      undefined,
    ]) {
      expect(resolveJwtSecret(REAL_SECRET, nodeEnv)).toBe(REAL_SECRET);
    }
  });

  it('allows the dev-only fallback when absent under development/test', () => {
    expect(resolveJwtSecret(undefined, 'development')).toBe(
      DEV_ONLY_FALLBACK_SECRET,
    );
    expect(resolveJwtSecret(undefined, 'test')).toBe(DEV_ONLY_FALLBACK_SECRET);
  });

  it.each(['production', 'staging', 'preview', 'weird-value'])(
    'throws when absent under NODE_ENV=%s',
    (nodeEnv) => {
      expect(() => resolveJwtSecret(undefined, nodeEnv)).toThrow(
        'JWT_ACCESS_SECRET is required',
      );
    },
  );

  it('throws when absent and NODE_ENV is unset', () => {
    expect(() => resolveJwtSecret(undefined, undefined)).toThrow(
      'JWT_ACCESS_SECRET is required',
    );
  });

  it('never returns the dev fallback outside development/test', () => {
    for (const nodeEnv of ['production', 'staging', 'preview', undefined]) {
      expect(() => resolveJwtSecret(undefined, nodeEnv)).toThrow();
    }
  });
});

describe('resolveJwtSecret length (ADR-P046)', () => {
  it('fails boot on a configured secret shorter than 32 bytes', () => {
    expect(() => resolveJwtSecret('x'.repeat(31), 'production')).toThrow(
      `JWT_ACCESS_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes`,
    );
    expect(resolveJwtSecret('x'.repeat(32), 'production')).toBe('x'.repeat(32));
  });

  it('counts bytes, not characters', () => {
    // 16 two-byte characters are 32 bytes.
    expect(resolveJwtSecret('ñ'.repeat(16), 'production')).toBe('ñ'.repeat(16));
    expect(() => resolveJwtSecret('ñ'.repeat(15), 'production')).toThrow();
  });
});
