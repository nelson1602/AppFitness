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

  // ── Conflict resolution (ADR-P030 C-3 contract, consumed by C-4) ───────────

  describe('conflicts', () => {
    const CONFLICT = '11111111-1111-4111-8111-111111111111';
    const CURRENT = { row: { id: 'bw-1', weight_kg: 81 }, version: 6, deleted: false };

    function conflictResponse(status: number, body: unknown): Response {
      return { ok: status < 400, status, json: () => Promise.resolve(body) } as unknown as Response;
    }

    it('lists conflicts with bounded status-only reconciliation ids', async () => {
      fetchMock.mockResolvedValue(
        okResponse({ conflicts: [], statuses: [], nextCursor: null, hasMore: false }),
      );
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      await transport.listConflicts({ ids: ['a', 'b'], cursor: 'c1', limit: 50 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('http://api.test/sync/conflicts?cursor=c1&limit=50&ids=a%2Cb');
    });

    it('lists without a query string when no options are given', async () => {
      fetchMock.mockResolvedValue(
        okResponse({ conflicts: [], statuses: [], nextCursor: null, hasMore: false }),
      );
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      await transport.listConflicts();

      expect((fetchMock.mock.calls[0] as [string])[0]).toBe('http://api.test/sync/conflicts');
    });

    it('posts a resolution and returns the typed 200 outcome', async () => {
      fetchMock.mockResolvedValue(
        conflictResponse(200, {
          outcome: 'RESOLVED',
          resolution: 'CLIENT_WINS',
          current: CURRENT,
        }),
      );
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      const result = await transport.resolveConflict(CONFLICT, {
        resolution: 'CLIENT_WINS',
        expectedServerVersion: 5,
        expectedDeleted: false,
        operation: 'UPDATE',
        payload: { weight_kg: 81 },
      });

      expect(result).toEqual({ outcome: 'RESOLVED', resolution: 'CLIENT_WINS', current: CURRENT });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://api.test/sync/conflicts/${CONFLICT}/resolve`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        resolution: 'CLIENT_WINS',
        expectedServerVersion: 5,
        expectedDeleted: false,
        operation: 'UPDATE',
        payload: { weight_kg: 81 },
      });
    });

    it.each(['STALE_COMPARISON', 'RESTORE_UNSUPPORTED', 'ALREADY_RESOLVED_OPPOSITE_CHOICE'])(
      'treats the 409 %s body as a typed outcome, not an error',
      async (outcome) => {
        fetchMock.mockResolvedValue(conflictResponse(409, { outcome, current: CURRENT }));
        const transport = createSyncTransport(() => 'token-1', 'http://api.test');

        await expect(
          transport.resolveConflict(CONFLICT, {
            resolution: 'SERVER_WINS',
            expectedServerVersion: 5,
            expectedDeleted: false,
          }),
        ).resolves.toMatchObject({ outcome, current: CURRENT });
      },
    );

    it('reads only the contract fields — no server-authored text survives', async () => {
      fetchMock.mockResolvedValue(
        conflictResponse(409, {
          outcome: 'RESTORE_UNSUPPORTED',
          current: CURRENT,
          message: 'Row 42 was deleted by Dr Smith',
          error: 'Conflict',
        }),
      );
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      const result = await transport.resolveConflict(CONFLICT, {
        resolution: 'CLIENT_WINS',
        expectedServerVersion: 5,
        expectedDeleted: true,
        operation: 'UPDATE',
        payload: {},
      });

      expect(result).toEqual({ outcome: 'RESTORE_UNSUPPORTED', current: CURRENT });
      expect(JSON.stringify(result)).not.toContain('Dr Smith');
    });

    it.each([
      [400, { message: 'Invalid conflict resolution request' }],
      [404, { message: 'Conflict not found' }],
      [500, {}],
    ])('maps a %s response to SyncHttpError', async (status, body) => {
      fetchMock.mockResolvedValue(conflictResponse(status, body));
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      await expect(
        transport.resolveConflict(CONFLICT, {
          resolution: 'SERVER_WINS',
          expectedServerVersion: 5,
          expectedDeleted: false,
        }),
      ).rejects.toMatchObject({ status });
    });

    it.each([
      ['an unknown outcome', { outcome: 'SOMETHING_NEW', current: CURRENT }],
      ['a missing current', { outcome: 'RESOLVED' }],
      ['a malformed current', { outcome: 'RESOLVED', current: { row: null, version: 'x' } }],
      ['a non-object body', 'plain text'],
    ])('rejects %s rather than acting on it', async (_label, body) => {
      fetchMock.mockResolvedValue(conflictResponse(200, body));
      const transport = createSyncTransport(() => 'token-1', 'http://api.test');

      await expect(
        transport.resolveConflict(CONFLICT, {
          resolution: 'SERVER_WINS',
          expectedServerVersion: 5,
          expectedDeleted: false,
        }),
      ).rejects.toBeInstanceOf(SyncHttpError);
    });

    it('requires a token before any conflict request', async () => {
      const transport = createSyncTransport(() => null, 'http://api.test');

      await expect(transport.listConflicts()).rejects.toMatchObject({ status: 401 });
      await expect(
        transport.resolveConflict(CONFLICT, {
          resolution: 'SERVER_WINS',
          expectedServerVersion: 1,
          expectedDeleted: false,
        }),
      ).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
