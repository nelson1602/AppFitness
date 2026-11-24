import { vi } from 'vitest';

export interface MockReply {
  status?: number;
  body?: unknown;
}

export type Handler = (init: RequestInit) => MockReply;

/**
 * Stubs global fetch. `routes` maps "METHOD path" (path relative to
 * /admin/api, query string included) to a reply or a reply factory.
 * Unmatched calls answer 404 so a missing stub fails loudly.
 */
export function mockFetch(routes: Record<string, MockReply | Handler>) {
  const fn = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const path = url.replace(/^\/admin\/api\//, '');
    const key = `${init.method ?? 'GET'} ${path}`;
    const route = routes[key];
    const reply: MockReply = route
      ? typeof route === 'function'
        ? route(init)
        : route
      : { status: 404, body: { statusCode: 404, message: `No mock: ${key}` } };
    const status = reply.status ?? 200;
    const body =
      reply.body === undefined || status === 204
        ? null
        : JSON.stringify(reply.body);
    return Promise.resolve(
      new Response(body, {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];

export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

/** Parsed JSON body of the first call whose URL ends with `suffix`. */
export function bodyOfCall(calls: FetchCall[], suffix: string): unknown {
  const call = calls.find(([input]) => urlOf(input).endsWith(suffix));
  const body = call?.[1]?.body;
  return typeof body === 'string' ? (JSON.parse(body) as unknown) : undefined;
}

export function countCalls(calls: FetchCall[], suffix: string): number {
  return calls.filter(([input]) => urlOf(input).endsWith(suffix)).length;
}

export function headersOf(
  init: RequestInit | undefined,
): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>;
}
