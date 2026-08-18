import { resolveJwtSecret } from './auth.module';

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
