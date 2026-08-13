import { buildWebCorsOptions, parseWebCorsOrigins } from './cors.config';

describe('parseWebCorsOrigins (ADR-P018 Slice 3)', () => {
  it('returns an empty allow-list when unset or blank (fail-closed)', () => {
    expect(parseWebCorsOrigins(undefined)).toEqual([]);
    expect(parseWebCorsOrigins('')).toEqual([]);
    expect(parseWebCorsOrigins('   ')).toEqual([]);
    expect(parseWebCorsOrigins(',, ,')).toEqual([]);
  });

  it('parses, trims, and de-duplicates exact origins in first-seen order', () => {
    expect(
      parseWebCorsOrigins(
        ' http://localhost:8081 , http://127.0.0.1:8081 , http://localhost:8081 ',
      ),
    ).toEqual(['http://localhost:8081', 'http://127.0.0.1:8081']);
    expect(parseWebCorsOrigins('https://app.example.com')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('rejects a wildcard entry', () => {
    expect(() => parseWebCorsOrigins('*')).toThrow(/Invalid WEB_CORS_ORIGINS/);
    expect(() => parseWebCorsOrigins('http://localhost:8081,*')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
    expect(() => parseWebCorsOrigins('https://*.example.com')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
  });

  it('rejects malformed origins (missing scheme, trailing slash, or path)', () => {
    expect(() => parseWebCorsOrigins('localhost:8081')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
    expect(() => parseWebCorsOrigins('http://localhost:8081/')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
    expect(() => parseWebCorsOrigins('http://localhost:8081/app')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
    expect(() => parseWebCorsOrigins('ftp://localhost:8081')).toThrow(
      /Invalid WEB_CORS_ORIGINS/,
    );
  });
});

describe('buildWebCorsOptions (ADR-P018 Slice 3)', () => {
  it('never enables credentials and restricts methods/headers to the interim surface', () => {
    const options = buildWebCorsOptions('http://localhost:8081');

    expect(options.credentials).toBe(false);
    expect(options.origin).toEqual(['http://localhost:8081']);
    expect(options.methods).toEqual([
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ]);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
    // PATCH/HEAD/TRACE/CONNECT are not served by the API and must not be allowed.
    expect(options.methods).not.toContain('PATCH');
    expect(options.methods).not.toContain('TRACE');
    expect(options.methods).not.toContain('CONNECT');
    expect(options.maxAge).toBe(600);
    expect(options.optionsSuccessStatus).toBe(204);
  });

  it('is fail-closed (empty origin allow-list) when nothing is configured', () => {
    expect(buildWebCorsOptions(undefined).origin).toEqual([]);
    expect(buildWebCorsOptions('').origin).toEqual([]);
  });
});
