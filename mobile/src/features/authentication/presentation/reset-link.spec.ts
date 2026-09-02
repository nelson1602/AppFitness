import { parseTokenFromFragment, readTokenParam } from './reset-link';
import { scrubbedUrl, type BrowserLocationLike } from './reset-link.web-location';

const location = (parts: Partial<BrowserLocationLike>): BrowserLocationLike => ({
  pathname: '/reset-password',
  search: '',
  hash: '',
  ...parts,
});

/**
 * ADR-P026 correction: the emailed link carries the token in the fragment so
 * it never enters an HTTP request-line, and the landing page scrubs it from
 * the address bar once it is in memory.
 */
describe('parseTokenFromFragment', () => {
  it('reads the token with or without the leading hash', () => {
    expect(parseTokenFromFragment('#token=abc123')).toBe('abc123');
    expect(parseTokenFromFragment('token=abc123')).toBe('abc123');
  });

  it('percent-decodes the value the server encoded', () => {
    expect(parseTokenFromFragment('#token=a%2Bb%2Fc%3Dd%26e')).toBe('a+b/c=d&e');
  });

  it('finds the token among other fragment entries', () => {
    expect(parseTokenFromFragment('#foo=1&token=abc123&bar=2')).toBe('abc123');
  });

  it('returns null when the fragment is absent, empty, or has no token', () => {
    expect(parseTokenFromFragment(undefined)).toBeNull();
    expect(parseTokenFromFragment(null)).toBeNull();
    expect(parseTokenFromFragment('')).toBeNull();
    expect(parseTokenFromFragment('#')).toBeNull();
    expect(parseTokenFromFragment('#other=1')).toBeNull();
    expect(parseTokenFromFragment('#token=')).toBeNull();
    expect(parseTokenFromFragment('#token')).toBeNull();
  });

  it('refuses a repeated token key rather than guessing', () => {
    expect(parseTokenFromFragment('#token=a&token=b')).toBeNull();
  });

  it('refuses a malformed percent-escape instead of forwarding raw text', () => {
    expect(parseTokenFromFragment('#token=%E0%A4%A')).toBeNull();
  });

  it('does not confuse a key that merely ends in "token"', () => {
    expect(parseTokenFromFragment('#access_token=abc')).toBeNull();
  });
});

describe('readTokenParam (native custom scheme)', () => {
  it('accepts a single well-formed value', () => {
    expect(readTokenParam('raw-token')).toBe('raw-token');
    expect(readTokenParam('  raw-token  ')).toBe('raw-token');
  });

  it('rejects a missing, empty, or repeated parameter', () => {
    expect(readTokenParam(undefined)).toBeNull();
    expect(readTokenParam('')).toBeNull();
    expect(readTokenParam('   ')).toBeNull();
    expect(readTokenParam(['a', 'b'])).toBeNull();
  });
});

describe('scrubbedUrl', () => {
  it('drops the fragment carrying the token', () => {
    expect(scrubbedUrl(location({ hash: '#token=abc123' }))).toBe('/reset-password');
  });

  it('drops a token query parameter too, as defence in depth', () => {
    expect(scrubbedUrl(location({ search: '?token=abc123' }))).toBe('/reset-password');
  });

  it('keeps unrelated query parameters', () => {
    expect(scrubbedUrl(location({ search: '?lang=es&token=abc', hash: '#token=abc' }))).toBe(
      '/reset-password?lang=es',
    );
  });

  it('preserves the path it was given', () => {
    expect(scrubbedUrl(location({ pathname: '/app/reset-password', hash: '#token=x' }))).toBe(
      '/app/reset-password',
    );
  });

  it('returns null when there is nothing to strip', () => {
    expect(scrubbedUrl(location({}))).toBeNull();
    expect(scrubbedUrl(location({ hash: '#' }))).toBeNull();
    expect(scrubbedUrl(location({ search: '?lang=es' }))).toBeNull();
  });

  it('never leaves the token anywhere in the scrubbed URL', () => {
    const scrubbed = scrubbedUrl(
      location({ search: '?token=secret-value', hash: '#token=secret-value' }),
    );
    expect(scrubbed).not.toBeNull();
    expect(scrubbed).not.toContain('secret-value');
  });
});
