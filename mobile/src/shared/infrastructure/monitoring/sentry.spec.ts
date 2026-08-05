import * as Sentry from '@sentry/react-native';

import { initMonitoring, VERIFICATION_EVENT_NAME } from './sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

const mockInit = jest.mocked(Sentry.init);
const mockCapture = jest.mocked(Sentry.captureException);

const DSN = 'https://public@example.ingest.sentry.io/1';

describe('initMonitoring (ADR-P010)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    delete process.env.EXPO_PUBLIC_SENTRY_VERIFY_EVENT;
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

  describe('B2 verification harness (temporary; Phase 20 Gate B2-mobile)', () => {
    it('captures NO verification event when the flag is unset (all shipping variants)', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
      // EXPO_PUBLIC_SENTRY_VERIFY_EVENT deliberately unset.
      initMonitoring();
      expect(mockInit).toHaveBeenCalledTimes(1); // normal init still happens
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('captures NO verification event when the flag is set but no DSN (init skipped)', () => {
      process.env.EXPO_PUBLIC_SENTRY_VERIFY_EVENT = 'true';
      // No DSN → init returns early, so nothing is captured either.
      initMonitoring();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('captures exactly one controlled event with synthetic fields when the flag is set', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
      process.env.EXPO_PUBLIC_SENTRY_VERIFY_EVENT = 'true';

      initMonitoring();

      expect(mockCapture).toHaveBeenCalledTimes(1);
      const [err, ctx] = mockCapture.mock.calls[0] as [Error, { extra?: Record<string, unknown> }];
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(VERIFICATION_EVENT_NAME);
      // Synthetic sensitive-looking fields present pre-scrub; no real data.
      expect(ctx.extra).toEqual({
        notes: 'synthetic-notes-value-not-real-phi',
        token: 'synthetic-token-value-not-real',
      });
      expect(JSON.stringify(ctx.extra)).not.toMatch(/@|password|Bearer/i);
    });

    it("the event's synthetic notes/token are redacted by the same beforeSend scrubber", () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
      process.env.EXPO_PUBLIC_SENTRY_VERIFY_EVENT = 'true';

      initMonitoring();

      // The shipped build routes the captured event through beforeSend; prove
      // that path redacts the synthetic fields.
      const options = mockInit.mock.calls[0][0];
      const ctx = (mockCapture.mock.calls[0] as [Error, { extra: Record<string, unknown> }])[1];
      const scrubbed = (options.beforeSend as (e: unknown, h: unknown) => unknown)(
        { extra: { ...ctx.extra } },
        {},
      ) as { extra?: Record<string, unknown> };
      expect(scrubbed.extra?.['notes']).toBe('[REDACTED]');
      expect(scrubbed.extra?.['token']).toBe('[REDACTED]');
    });
  });
});
