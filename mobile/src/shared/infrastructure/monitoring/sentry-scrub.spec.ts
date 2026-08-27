import { redactDeep, scrubBreadcrumb, scrubEvent, stripQueryAndFragment } from './sentry-scrub';

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

  it('stripQueryAndFragment handles non-strings', () => {
    expect(stripQueryAndFragment(null)).toBeUndefined();
    expect(stripQueryAndFragment('https://a/b?c=1')).toBe('https://a/b');
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

  // ADR-P026 gate: the reset token lives in the URL **fragment**, so a
  // sanitizer that only stripped `?` would forward a live bearer credential
  // into a Sentry event. Everything from the earliest `?` or `#` must go.
  const RESET_SENTINEL = 'AbC123-reset-token-sentinel_XYZ';

  describe('stripQueryAndFragment', () => {
    it('strips a fragment carrying a reset token', () => {
      expect(
        stripQueryAndFragment(`https://app.example.com/reset-password#token=${RESET_SENTINEL}`),
      ).toBe('https://app.example.com/reset-password');
    });

    it('strips a query string carrying a reset token', () => {
      expect(
        stripQueryAndFragment(`https://app.example.com/reset-password?token=${RESET_SENTINEL}`),
      ).toBe('https://app.example.com/reset-password');
    });

    it('strips from the earliest separator when both are present', () => {
      expect(
        stripQueryAndFragment(
          `https://app.example.com/reset-password?lang=es#token=${RESET_SENTINEL}`,
        ),
      ).toBe('https://app.example.com/reset-password');
      // ...and when the fragment comes first, which a malformed URL allows.
      expect(
        stripQueryAndFragment(
          `https://app.example.com/reset-password#token=${RESET_SENTINEL}?lang=es`,
        ),
      ).toBe('https://app.example.com/reset-password');
    });

    it('leaves an ordinary URL with no query or fragment untouched', () => {
      expect(stripQueryAndFragment('https://app.example.com/dashboard')).toBe(
        'https://app.example.com/dashboard',
      );
      expect(stripQueryAndFragment('/reset-password')).toBe('/reset-password');
    });

    it('handles a bare separator and non-string input', () => {
      expect(stripQueryAndFragment('https://a/b#')).toBe('https://a/b');
      expect(stripQueryAndFragment('https://a/b?')).toBe('https://a/b');
      expect(stripQueryAndFragment(undefined)).toBeUndefined();
      expect(stripQueryAndFragment(null)).toBeUndefined();
      expect(stripQueryAndFragment(5)).toBeUndefined();
    });
  });

  it('keeps no raw reset token in a scrubbed event or any breadcrumb', () => {
    const event = scrubEvent({
      request: {
        method: 'GET',
        url: `https://app.example.com/reset-password#token=${RESET_SENTINEL}`,
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: {
            from: '/sign-in',
            to: `/reset-password#token=${RESET_SENTINEL}`,
          },
        },
        {
          category: 'fetch',
          data: {
            method: 'POST',
            status_code: 204,
            url: `https://api.example.com/auth/reset-password?token=${RESET_SENTINEL}`,
          },
        },
        {
          category: 'xhr',
          data: {
            url: `https://app.example.com/reset-password#token=${RESET_SENTINEL}`,
          },
        },
      ],
      extra: { resetUrl: `https://app.example.com/r#token=${RESET_SENTINEL}` },
    });

    // The single decisive assertion: the sentinel appears nowhere at all.
    expect(JSON.stringify(event)).not.toContain(RESET_SENTINEL);

    // ...and the useful, non-sensitive parts survive.
    expect(event.request?.url).toBe('https://app.example.com/reset-password');
    expect(event.breadcrumbs?.[1].data?.['url']).toBe(
      'https://api.example.com/auth/reset-password',
    );
    expect(event.breadcrumbs?.[1].data?.['status_code']).toBe(204);
  });

  it('strips the fragment on http/fetch/xhr breadcrumbs specifically', () => {
    for (const category of ['http', 'fetch', 'xhr']) {
      const crumb = scrubBreadcrumb({
        category,
        data: { url: `https://x/y#token=${RESET_SENTINEL}` },
      });
      expect(crumb.data?.['url']).toBe('https://x/y');
      expect(JSON.stringify(crumb)).not.toContain(RESET_SENTINEL);
    }
  });
});
