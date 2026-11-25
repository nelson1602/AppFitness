import { API_BASE_URL } from '@/shared/infrastructure/config/api-config';

import { APP_CONFIG_TIMEOUT_MS, fetchAppConfig } from './app-config-api';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  // Failures are logged in development only; keep the test output quiet.
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const answer = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('fetchAppConfig (ADR-P049 amendment 1)', () => {
  it('asks the public endpoint without an Authorization header and parses the answer', async () => {
    mockFetch.mockResolvedValue(
      answer(200, { maintenance: { tone: 'oops', message: { es: 'a', en: 'b' } } }),
    );
    await expect(fetchAppConfig()).resolves.toEqual({
      maintenance: { tone: 'warning', message: { es: 'a', en: 'b' } },
      minAndroidVersionCode: null,
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/app-config`);
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('resolves null on an error status, a network failure or an unreadable body', async () => {
    mockFetch.mockResolvedValueOnce(answer(503, {}));
    await expect(fetchAppConfig()).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(fetchAppConfig()).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    await expect(fetchAppConfig()).resolves.toBeNull();
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
          }),
      );
      const pending = fetchAppConfig();
      jest.advanceTimersByTime(APP_CONFIG_TIMEOUT_MS);
      await expect(pending).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
