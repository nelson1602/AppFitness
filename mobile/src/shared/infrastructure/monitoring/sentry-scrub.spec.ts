import { redactDeep, scrubBreadcrumb, scrubEvent, stripQuery } from './sentry-scrub';

describe('mobile sentry scrubbing (ADR-P010)', () => {
  it('redacts sensitive keys at any depth, keeps safe values', () => {
    const redacted = redactDeep({
      userId: 'user-1',
      attempt: 2,
      accessToken: 'eyJ-secret',
      session: { refreshToken: 'r1' },
      medical: {
        doctorNotes: 'patient has arrhythmia',
        medications: 'beta blockers',
        restrictionSeverity: 'SEVERE',
        injuryArea: 'knee',
        birthDate: '1990-01-15',
      },
      contact: { email: 'person@example.com', phone: '+1555', username: 'realname' },
    }) as Record<string, unknown>;

    expect(redacted['userId']).toBe('user-1');
    expect(redacted['attempt']).toBe(2);
    expect(redacted['accessToken']).toBe('[REDACTED]');
    expect(redacted['session']).toBe('[REDACTED]');
    const medical = redacted['medical'] as Record<string, unknown>;
    for (const field of [
      'doctorNotes',
      'medications',
      'restrictionSeverity',
      'injuryArea',
      'birthDate',
    ]) {
      expect(medical[field]).toBe('[REDACTED]');
    }
    expect(JSON.stringify(redacted)).not.toContain('arrhythmia');
    expect(JSON.stringify(redacted)).not.toContain('person@example.com');
  });

  it('reduces events to safe request/user shapes', () => {
    const event = scrubEvent({
      request: {
        url: 'http://127.0.0.1:3001/sync/pull?since=3',
        headers: { authorization: 'Bearer x' },
      },
      user: { id: 'user-1', email: 'person@example.com' },
      extra: { syncPayload: { doctor_notes: 'phi' }, retries: 1 },
      tags: { screen: 'dashboard', sessionKey: 'abc' },
    });

    expect(event.request).toEqual({ url: 'http://127.0.0.1:3001/sync/pull' });
    expect(event.user).toEqual({ id: 'user-1' });
    expect((event.extra as Record<string, unknown>)['syncPayload']).toBe('[REDACTED]');
    expect((event.extra as Record<string, unknown>)['retries']).toBe(1);
    expect((event.tags as Record<string, unknown>)['screen']).toBe('dashboard');
    expect((event.tags as Record<string, unknown>)['sessionKey']).toBe('[REDACTED]');
    expect(JSON.stringify(event)).not.toContain('Bearer');
  });

  it('omits user without id and tolerates empty events', () => {
    expect(scrubEvent({ user: { email: 'x@y.z' } }).user).toBeUndefined();
    expect(scrubEvent({})).toEqual({ user: undefined });
  });

  it('strips payloads from http/fetch breadcrumbs', () => {
    for (const category of ['http', 'fetch', 'xhr']) {
      const crumb = scrubBreadcrumb({
        category,
        data: {
          method: 'POST',
          status_code: 409,
          url: 'http://127.0.0.1:3001/sync/push?a=1',
          request_body: '{"payload":"phi"}',
        },
      });
      expect(crumb.data).toEqual({
        method: 'POST',
        status_code: 409,
        url: 'http://127.0.0.1:3001/sync/push',
      });
    }
  });

  it('redacts data on other breadcrumb categories', () => {
    const crumb = scrubBreadcrumb({
      category: 'navigation',
      data: { from: '/sign-in', to: '/dashboard', accessToken: 'x' },
    });
    expect(crumb.data?.['to']).toBe('/dashboard');
    expect(crumb.data?.['accessToken']).toBe('[REDACTED]');
  });

  it('stripQuery handles non-strings', () => {
    expect(stripQuery(null)).toBeUndefined();
    expect(stripQuery('https://a/b?c=1')).toBe('https://a/b');
  });

  it('caps recursion depth and walks arrays', () => {
    const deep = redactDeep({ a: { b: { c: { d: { e: 1 } } } } }) as Record<string, unknown>;
    const level3 = ((deep['a'] as Record<string, unknown>)['b'] as Record<string, unknown>)[
      'c'
    ] as Record<string, unknown>;
    expect(level3['d']).toBe('[MAX_DEPTH]');

    const arr = redactDeep([{ accessToken: 'x', ok: 1 }]) as Record<string, unknown>[];
    expect(arr[0]['accessToken']).toBe('[REDACTED]');
    expect(arr[0]['ok']).toBe(1);
  });

  it('scrubs contexts and passes through crumbs without data', () => {
    const event = scrubEvent({
      contexts: { device: { model: 'Pixel' }, session: { refreshToken: 'r' } },
      breadcrumbs: [{ category: 'fetch', data: { url: 'http://x/sync/pull?since=2' } }],
    });
    expect(event.breadcrumbs?.[0].data?.['url']).toBe('http://x/sync/pull');
    const contexts = event.contexts as Record<string, unknown>;
    expect((contexts['device'] as Record<string, unknown>)['model']).toBe('Pixel');
    expect(contexts['session']).toBe('[REDACTED]');

    expect(scrubBreadcrumb({ message: 'plain' })).toEqual({ message: 'plain' });
    expect(scrubBreadcrumb({ category: 'http', data: undefined }).data).toEqual({
      method: undefined,
      status_code: undefined,
      url: undefined,
    });
  });
});
