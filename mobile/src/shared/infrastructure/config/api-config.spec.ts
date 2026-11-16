import { ApiConfigError, resolveApiBaseUrl } from './api-config';

const release = (url: string | undefined, appVariant?: string) =>
  resolveApiBaseUrl({ url, isDev: false, appVariant });

describe('resolveApiBaseUrl (ADR-P047 D5)', () => {
  it('falls back to the local dev server only in a development bundle', () => {
    expect(resolveApiBaseUrl({ url: undefined, isDev: true, appVariant: undefined })).toBe(
      'http://localhost:3001',
    );
    expect(() => release(undefined)).toThrow(ApiConfigError);
    expect(() => release('   ')).toThrow(ApiConfigError);
  });

  it('accepts https in a release bundle and drops a trailing slash', () => {
    expect(release('https://api.example.test/')).toBe('https://api.example.test');
    expect(release('https://api.example.test:8443/v1')).toBe('https://api.example.test:8443/v1');
  });

  it('refuses http in a release bundle', () => {
    expect(() => release('http://api.example.test')).toThrow(/https/);
    expect(() => release('http://127.0.0.1:3001')).toThrow(/https/);
  });

  it('allows http to loopback only in the e2e variant', () => {
    expect(release('http://127.0.0.1:3001', 'e2e')).toBe('http://127.0.0.1:3001');
    expect(release('http://localhost:3001', 'e2e')).toBe('http://localhost:3001');
    expect(() => release('http://10.0.2.2:3001', 'e2e')).toThrow(ApiConfigError);
    expect(() => release('http://api.example.test', 'e2e')).toThrow(ApiConfigError);
  });

  it('refuses anything that is not an absolute http(s) URL', () => {
    for (const bad of ['ftp://x.test', 'api.example.test', 'https://', 'https://x.test?a=1']) {
      expect(() => release(bad)).toThrow(ApiConfigError);
    }
  });

  it('keeps http in a development bundle (emulator against a laptop API)', () => {
    expect(
      resolveApiBaseUrl({ url: 'http://10.0.2.2:3001', isDev: true, appVariant: undefined }),
    ).toBe('http://10.0.2.2:3001');
  });
});
