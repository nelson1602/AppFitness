// Minimal fetch wrapper for /admin/api.
//
// Security rules (see admin/README.md):
// - The session is an HttpOnly cookie set by the API. This client never reads,
//   stores or forwards tokens; it only sends same-origin credentials.
// - Every non-GET request carries `X-Admin-CSRF: 1` and a JSON content type.
// - A 401 on a session-protected call hands control to the registered
//   unauthorized handler (the app routes to the login screen).

import { es } from '../i18n/es';

export const API_BASE = '/admin/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /**
   * Calls that legitimately answer 401 without a session problem (wrong
   * password, wrong TOTP code, invite endpoints) opt out of the global
   * "go to login" redirect.
   */
  skipUnauthorizedRedirect?: boolean;
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  let code: string | undefined;
  try {
    const data: unknown = await response.json();
    if (isRecord(data)) {
      if (typeof data.message === 'string') message = data.message;
      else if (Array.isArray(data.message)) message = data.message.join(', ');
      if (typeof data.code === 'string') code = data.code;
    }
  } catch {
    // Non-JSON error body: keep the status text.
  }
  return new ApiError(response.status, message, code);
}

/**
 * Sends the request with the shared security rules and error handling, and
 * returns the successful response for the caller to read.
 */
async function send(
  path: string,
  options: RequestOptions,
  accept: string,
): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: accept };
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
  };
  if (method !== 'GET') {
    headers['X-Admin-CSRF'] = '1';
    headers['Content-Type'] = 'application/json';
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\//, '')}`, init);
  } catch {
    throw new ApiError(0, es.errors.network);
  }

  if (!response.ok) {
    const error = await readError(response);
    if (
      response.status === 401 &&
      !options.skipUnauthorizedRedirect &&
      unauthorizedHandler
    ) {
      unauthorizedHandler();
    }
    throw error;
  }
  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(path, options, 'application/json');
  if (response.status === 204 || response.status === 202) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * GETs a file (for example a CSV export) as a Blob. Same credentials, 401
 * redirect and error mapping as `apiRequest`.
 */
export async function apiDownload(path: string, accept: string): Promise<Blob> {
  const response = await send(path, {}, accept);
  try {
    return await response.blob();
  } catch {
    throw new ApiError(0, es.errors.network);
  }
}

/** Builds a query string, dropping empty values. */
export function toQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Spanish, user-facing message for any error thrown by the client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return es.errors.network;
      case 401:
        return es.errors.sessionExpired;
      case 403:
        return es.errors.forbidden;
      case 404:
        return es.errors.notFound;
      case 429:
        return es.errors.tooMany;
      case 503:
        return es.errors.unavailable;
      default:
        return es.errors.generic;
    }
  }
  return es.errors.generic;
}
