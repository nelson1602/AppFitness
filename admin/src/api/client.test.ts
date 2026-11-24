import { describe, expect, it, vi } from 'vitest';
import { headersOf, mockFetch } from '../test/fetchMock';
import {
  ApiError,
  apiRequest,
  errorMessage,
  setUnauthorizedHandler,
} from './client';
import { es } from '../i18n/es';

describe('apiRequest', () => {
  it('sends GET with same-origin credentials and no CSRF header', async () => {
    const fetchMock = mockFetch({ 'GET auth/me': { body: { id: '1' } } });

    await apiRequest('auth/me');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/admin/api/auth/me');
    expect(init?.credentials).toBe('same-origin');
    expect(headersOf(init)).not.toHaveProperty('X-Admin-CSRF');
    expect(headersOf(init)).not.toHaveProperty('Content-Type');
    expect(init?.body).toBeUndefined();
  });

  it.each(['POST', 'PATCH', 'DELETE'] as const)(
    'adds the CSRF header and JSON content type on %s',
    async (method) => {
      const fetchMock = mockFetch({ [`${method} roles/1`]: { status: 204 } });

      await apiRequest('roles/1', { method, body: { name: 'x' } });

      const init = fetchMock.mock.calls[0]?.[1];
      expect(init?.credentials).toBe('same-origin');
      expect(headersOf(init)['X-Admin-CSRF']).toBe('1');
      expect(headersOf(init)['Content-Type']).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ name: 'x' }));
    },
  );

  it('calls the unauthorized handler on 401', async () => {
    mockFetch({
      'GET users': { status: 401, body: { statusCode: 401, message: 'no' } },
    });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(apiRequest('users')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not redirect on 401 when the call opts out (bad password)', async () => {
    mockFetch({
      'POST auth/login': { status: 401, body: { statusCode: 401 } },
    });
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(
      apiRequest('auth/login', {
        method: 'POST',
        body: {},
        skipUnauthorizedRedirect: true,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('maps statuses to the Spanish messages', () => {
    expect(errorMessage(new ApiError(403, ''))).toBe(es.errors.forbidden);
    expect(errorMessage(new ApiError(429, ''))).toBe(es.errors.tooMany);
    expect(errorMessage(new ApiError(503, ''))).toBe(es.errors.unavailable);
  });

  it('keeps the error code from the body', async () => {
    mockFetch({
      'DELETE roles/9': {
        status: 409,
        body: { statusCode: 409, message: 'in use', code: 'ROLE_IN_USE' },
      },
    });
    await expect(
      apiRequest('roles/9', { method: 'DELETE' }),
    ).rejects.toMatchObject({ status: 409, code: 'ROLE_IN_USE' });
  });
});
