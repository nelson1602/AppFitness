import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';

import {
  FoodSearchOfflineError,
  FoodSearchRequestError,
  createCustomFood,
  importRemoteFood,
  searchRemoteFoods,
} from './food-search-api';

// A faithful in-memory session (generation + owner comparison), NOT a stub.
jest.mock('@/features/authentication', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);

const auth = authModule as unknown as FakeSessionModule;
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

function reply(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function headersOf(call: number): Record<string, string> {
  return fetchMock.mock.calls[call][1].headers as Record<string, string>;
}

beforeEach(() => {
  fetchMock.mockReset();
  auth.refreshTokens.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  auth.becomeUser('user-1');
});

describe('food search API (v10 Block B, item 7)', () => {
  it('searches with the encoded, trimmed query and the access token', async () => {
    const body = { results: [], external: 'ok' };
    fetchMock.mockResolvedValueOnce(reply(200, body));

    await expect(searchRemoteFoods('  Chicharrón de cerdo ', 5)).resolves.toEqual(body);

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/foods\/search\?q=Chicharr%C3%B3n%20de%20cerdo&limit=5$/,
    );
    expect(headersOf(0)).toEqual({ Authorization: 'Bearer user-1-access' });
  });

  it('posts an import with JSON and never sends nutrition values', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { id: 'food-1' }));

    await expect(importRemoteFood('off', '7501011131026')).resolves.toEqual({ id: 'food-1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/foods\/import$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ source: 'off', sourceId: '7501011131026' });
    expect(headersOf(0)['Content-Type']).toBe('application/json');
  });

  it('posts a custom food', async () => {
    fetchMock.mockResolvedValueOnce(reply(201, { id: 'custom-1' }));
    const input = {
      name: 'Chicharrón de mamá',
      servingAmount: 1,
      servingUnit: 'piece' as const,
      gramsPerServing: 30,
      caloriesPerServing: 160,
      proteinPerServing: 9,
      carbsPerServing: 0,
      fatPerServing: 14,
    };

    await expect(createCustomFood(input)).resolves.toEqual({ id: 'custom-1' });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/foods\/custom$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(input);
  });

  it('rotates an expired token once and retries for the same account', async () => {
    fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200, { results: [] }));
    auth.refreshTokens.mockImplementationOnce(() =>
      Promise.resolve(
        auth.rotateTo({
          accessToken: 'user-1-fresh',
          refreshToken: 'user-1-refresh-2',
          user: auth.getSession()!.user,
        }),
      ),
    );

    await expect(searchRemoteFoods('arroz')).resolves.toEqual({ results: [] });

    expect(auth.refreshTokens).toHaveBeenCalledTimes(1);
    expect(headersOf(1).Authorization).toBe('Bearer user-1-fresh');
  });

  it('answers 401 when the refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(reply(401));
    auth.refreshTokens.mockResolvedValueOnce(null);

    await expect(searchRemoteFoods('arroz')).rejects.toEqual(new FoodSearchRequestError(401));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries with a token for another account', async () => {
    fetchMock.mockResolvedValueOnce(reply(401));
    auth.refreshTokens.mockImplementationOnce(() => Promise.resolve(auth.becomeUser('user-2')));

    await expect(searchRemoteFoods('arroz')).rejects.toBeInstanceOf(FoodSearchRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the account changed during the request', async () => {
    fetchMock.mockImplementationOnce(() => {
      auth.becomeUser('user-2');
      return Promise.resolve(reply(401));
    });

    await expect(searchRemoteFoods('arroz')).rejects.toEqual(new FoodSearchRequestError(401));
    expect(auth.refreshTokens).not.toHaveBeenCalled();
  });

  it('reports a network failure as offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(searchRemoteFoods('arroz')).rejects.toBeInstanceOf(FoodSearchOfflineError);
  });

  it('reports a server error by status code only', async () => {
    fetchMock.mockResolvedValueOnce(reply(503, { secret: 'never surfaced' }));

    const error = await searchRemoteFoods('arroz').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodSearchRequestError);
    expect((error as FoodSearchRequestError).status).toBe(503);
    expect((error as Error).message).not.toContain('never surfaced');
  });
});
