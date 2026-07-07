import * as Sentry from '@sentry/react-native';

import { initMonitoring } from './sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
}));

const mockInit = jest.mocked(Sentry.init);

describe('initMonitoring (ADR-P010)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
  });

  it('stays fully disabled without a DSN (dev, tests, e2e builds)', () => {
    initMonitoring();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes with privacy-safe defaults when a DSN is provided', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = 'internal-testing';

    initMonitoring();

    expect(mockInit).toHaveBeenCalledTimes(1);
    const options = mockInit.mock.calls[0][0];
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.environment).toBe('internal-testing');
    expect(typeof options.beforeSend).toBe('function');
    expect(typeof options.beforeBreadcrumb).toBe('function');
  });

  it('wires the scrubbers into beforeSend/beforeBreadcrumb', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';

    initMonitoring();

    const options = mockInit.mock.calls[0][0];
    const scrubbed = (options.beforeSend as (e: unknown, h: unknown) => unknown)(
      { user: { id: 'u1', email: 'x@y.z' }, extra: { accessToken: 't' } },
      {},
    ) as { user?: unknown; extra?: Record<string, unknown> };
    expect(scrubbed.user).toEqual({ id: 'u1' });
    expect(scrubbed.extra?.['accessToken']).toBe('[REDACTED]');

    const crumb = (options.beforeBreadcrumb as (c: unknown) => unknown)({
      category: 'fetch',
      data: { url: 'http://x/y?token=1', request_body: 'phi' },
    }) as { data?: Record<string, unknown> };
    expect(crumb.data?.['url']).toBe('http://x/y');
    expect(crumb.data?.['request_body']).toBeUndefined();
  });
});
