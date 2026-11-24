import { parseAdminPublicUrl, resolveAdminConfig } from './admin.config';

const KEY = Buffer.alloc(32, 7).toString('base64');
const SECRET = 's'.repeat(32);
const URL_OK = 'https://api.example.test/admin/';

describe('resolveAdminConfig (ADR-P049)', () => {
  it('is disabled when nothing is set', () => {
    expect(resolveAdminConfig({})).toEqual({ enabled: false });
    expect(
      resolveAdminConfig({ ADMIN_SESSION_SECRET: '  ', ADMIN_PUBLIC_URL: '' }),
    ).toEqual({ enabled: false });
  });

  it('is enabled with all three, and normalizes the URL', () => {
    const config = resolveAdminConfig({
      ADMIN_SESSION_SECRET: SECRET,
      ADMIN_TOTP_ENC_KEY: KEY,
      ADMIN_PUBLIC_URL: URL_OK,
    });
    expect(config).toMatchObject({
      enabled: true,
      publicUrl: 'https://api.example.test/admin',
      staticDir: null,
    });
  });

  it.each([
    [{ ADMIN_SESSION_SECRET: SECRET }],
    [{ ADMIN_SESSION_SECRET: SECRET, ADMIN_TOTP_ENC_KEY: KEY }],
    [{ ADMIN_TOTP_ENC_KEY: KEY, ADMIN_PUBLIC_URL: URL_OK }],
  ])('refuses a half configuration %#', (env) => {
    expect(() => resolveAdminConfig(env)).toThrow(/set together/);
  });

  it('refuses a short session secret', () => {
    expect(() =>
      resolveAdminConfig({
        ADMIN_SESSION_SECRET: 'short',
        ADMIN_TOTP_ENC_KEY: KEY,
        ADMIN_PUBLIC_URL: URL_OK,
      }),
    ).toThrow(/at least 32 bytes/);
  });

  it('refuses a TOTP key that is not 32 bytes', () => {
    expect(() =>
      resolveAdminConfig({
        ADMIN_SESSION_SECRET: SECRET,
        ADMIN_TOTP_ENC_KEY: Buffer.alloc(16).toString('base64'),
        ADMIN_PUBLIC_URL: URL_OK,
      }),
    ).toThrow(/exactly 32 bytes/);
  });
});

describe('parseAdminPublicUrl', () => {
  it('accepts https and http on localhost', () => {
    expect(parseAdminPublicUrl('http://localhost:3001/admin')).toBe(
      'http://localhost:3001/admin',
    );
  });

  it.each([
    'http://api.example.test/admin',
    'https://api.example.test/admin?x=1',
    'https://api.example.test/admin#x',
    'not a url',
  ])('refuses %s', (raw) => {
    expect(() => parseAdminPublicUrl(raw)).toThrow();
  });
});
