import { resolveDatabaseUrl } from './prisma.service';

const DEV_ONLY_PLACEHOLDER_URL =
  'postgresql://placeholder:placeholder@localhost:5433/appfitness_dev';
const REAL_URL = 'postgresql://user:pw@db.internal:5432/appfitness';

describe('resolveDatabaseUrl (DATABASE_URL fail-closed config, C-2)', () => {
  it('returns the configured URL verbatim regardless of NODE_ENV', () => {
    for (const nodeEnv of [
      'development',
      'test',
      'production',
      'staging',
      'preview',
      'weird-value',
      undefined,
    ]) {
      expect(resolveDatabaseUrl(REAL_URL, nodeEnv)).toBe(REAL_URL);
    }
  });

  it('allows the dev-only placeholder when absent under development/test', () => {
    expect(resolveDatabaseUrl(undefined, 'development')).toBe(
      DEV_ONLY_PLACEHOLDER_URL,
    );
    expect(resolveDatabaseUrl(undefined, 'test')).toBe(
      DEV_ONLY_PLACEHOLDER_URL,
    );
  });

  it.each(['production', 'staging', 'preview', 'weird-value'])(
    'throws when absent under NODE_ENV=%s',
    (nodeEnv) => {
      expect(() => resolveDatabaseUrl(undefined, nodeEnv)).toThrow(
        'DATABASE_URL is required',
      );
    },
  );

  it('throws when absent and NODE_ENV is unset', () => {
    expect(() => resolveDatabaseUrl(undefined, undefined)).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('never returns the placeholder outside development/test', () => {
    for (const nodeEnv of ['production', 'staging', 'preview', undefined]) {
      expect(() => resolveDatabaseUrl(undefined, nodeEnv)).toThrow();
    }
  });
});
