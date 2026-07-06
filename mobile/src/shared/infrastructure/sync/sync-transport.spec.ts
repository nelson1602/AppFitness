import { createSyncTransport, SyncHttpError } from './sync-transport';

const fetchMock = jest.fn();

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as unknown as Response;
}

describe('sync transport', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('push posts operations with a bearer token and returns results', async () => {
    fetchMock.mockResolvedValue(okResponse({ results: [{ opId: 'op-1', status: 'APPLIED' }] }));
    const transport = createSyncTransport(() => 'token-1', 'http://api.test');

    const results = await transport.push([
      {
        opId: 'op-1',
        entityType: 'goals',
        entityId: 'goal-1',
        operation: 'CREATE',
        baseVersion: 0,
        payload: { id: 'goal-1' },
      },
    ]);

    expect(results).toEqual([{ opId: 'op-1', status: 'APPLIED' }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/sync/push');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-1');
    expect(JSON.parse(init.body as string)).toEqual({
      operations: [
        {
          opId: 'op-1',
          entityType: 'goals',
          entityId: 'goal-1',
          operation: 'CREATE',
          baseVersion: 0,
          payload: { id: 'goal-1' },
        },
      ],
    });
  });

  it('pull requests changes with cursor, entity types, and limit', async () => {
    fetchMock.mockResolvedValue(okResponse({ changes: [], nextCursor: 5, hasMore: false }));
    const transport = createSyncTransport(() => 'token-1', 'http://api.test');

    const response = await transport.pull(5, ['goals', 'user_profiles'], 100);

    expect(response).toEqual({ changes: [], nextCursor: 5, hasMore: false });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      'http://api.test/sync/pull?since=5&limit=100&entityTypes=goals%2Cuser_profiles',
    );
  });

  it('throws SyncHttpError(401) before any network call when the token is missing', async () => {
    const transport = createSyncTransport(() => null, 'http://api.test');

    await expect(transport.push([])).rejects.toMatchObject({ status: 401 });
    await expect(transport.pull(0, ['goals'], 10)).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps non-OK responses to SyncHttpError with the response status', async () => {
    fetchMock.mockResolvedValue(errorResponse(503));
    const transport = createSyncTransport(() => 'token-1', 'http://api.test');

    await expect(transport.push([])).rejects.toBeInstanceOf(SyncHttpError);
    await expect(transport.pull(0, ['goals'], 10)).rejects.toMatchObject({ status: 503 });
  });
});
