import { isApiDocsEnabled } from './api-docs.config';
import {
  HSTS_MAX_AGE_SECONDS,
  HTTP_BODY_LIMIT,
  buildHelmetOptions,
  configureHttpHardening,
  registerGracefulShutdown,
} from './http-hardening.config';

describe('buildHelmetOptions (ADR-P021 H-1A)', () => {
  // CSP resolution as it flows through the exact H-2 docs gate.
  const cspFor = (flag: string | undefined) =>
    buildHelmetOptions(isApiDocsEnabled(flag)).contentSecurityPolicy;

  it('keeps CSP enabled in hosted/default mode (docs disabled)', () => {
    // Key omitted => Helmet default CSP applies.
    expect(buildHelmetOptions(false).contentSecurityPolicy).toBeUndefined();
  });

  it('disables ONLY CSP for the exact API_DOCS_ENABLED === "true"', () => {
    expect(cspFor('true')).toBe(false);
  });

  it('does NOT disable CSP for invalid/alternative flag values', () => {
    for (const flag of ['TRUE', '1', ' true ', 'false', '', undefined]) {
      expect(cspFor(flag)).toBeUndefined();
    }
  });

  it('sets exact HSTS values (1y, no subdomains, no preload)', () => {
    for (const docs of [true, false]) {
      expect(buildHelmetOptions(docs).strictTransportSecurity).toEqual({
        maxAge: 31536000,
        includeSubDomains: false,
        preload: false,
      });
    }
    expect(HSTS_MAX_AGE_SECONDS).toBe(31536000);
  });
});

describe('configureHttpHardening (ADR-P021 H-1A)', () => {
  interface MockApp {
    use: jest.Mock;
    useBodyParser: jest.Mock;
  }
  const mockApp = (): MockApp => ({ use: jest.fn(), useBodyParser: jest.fn() });

  it('registers Helmet BEFORE the body parsers', () => {
    const app = mockApp();
    configureHttpHardening(app as never, undefined);
    expect(app.use).toHaveBeenCalledTimes(1);
    const helmetOrder = app.use.mock.invocationCallOrder[0];
    const firstParserOrder = app.useBodyParser.mock.invocationCallOrder[0];
    expect(helmetOrder).toBeLessThan(firstParserOrder);
  });

  it('registers JSON and URL-encoded parsers with the exact 100kb limits', () => {
    const app = mockApp();
    configureHttpHardening(app as never, undefined);
    expect(HTTP_BODY_LIMIT).toBe('100kb');
    expect(app.useBodyParser).toHaveBeenNthCalledWith(1, 'json', {
      limit: '100kb',
    });
    expect(app.useBodyParser).toHaveBeenNthCalledWith(2, 'urlencoded', {
      limit: '100kb',
      extended: true,
    });
  });
});

describe('registerGracefulShutdown (ADR-P021 H-1A)', () => {
  it('calls enableShutdownHooks exactly once', () => {
    const app = { enableShutdownHooks: jest.fn() };
    registerGracefulShutdown(app as never);
    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
  });
});
