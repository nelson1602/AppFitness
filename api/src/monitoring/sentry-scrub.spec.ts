import {
  redactDeep,
  scrubBreadcrumb,
  scrubEvent,
  stripQueryAndFragment,
} from './sentry-scrub';

describe('sentry scrubbing (ADR-P010)', () => {
  it('redacts sensitive keys at any depth', () => {
    const redacted = redactDeep({
      userId: 'user-1',
      password: 'hunter2',
      accessToken: 'eyJ-secret',
      nested: {
        doctorNotes: 'patient has arrhythmia',
        medications: 'beta blockers',
        restrictionType: 'INJURY',
        injuryArea: 'knee',
        medicalConditions: 'hypertension',
        MEDICAL_ENC_KEY: 'base64key',
        authorization: 'Bearer x',
        email: 'person@example.com',
        phone: '+1555',
        username: 'realname',
        birthDate: '1990-01-15',
        safeCount: 3,
      },
    }) as Record<string, unknown>;

    expect(redacted['userId']).toBe('user-1');
    expect(redacted['password']).toBe('[REDACTED]');
    expect(redacted['accessToken']).toBe('[REDACTED]');
    const nested = redacted['nested'] as Record<string, unknown>;
    for (const field of [
      'doctorNotes',
      'medications',
      'restrictionType',
      'injuryArea',
      'medicalConditions',
      'MEDICAL_ENC_KEY',
      'authorization',
      'email',
      'phone',
      'username',
      'birthDate',
    ]) {
      expect(nested[field]).toBe('[REDACTED]');
    }
    expect(nested['safeCount']).toBe(3);
    expect(JSON.stringify(redacted)).not.toContain('arrhythmia');
    expect(JSON.stringify(redacted)).not.toContain('hunter2');
  });

  it('drops request payloads, cookies, headers, and query strings from events', () => {
    const event = scrubEvent({
      request: {
        method: 'POST',
        url: 'https://api.test/auth/login?redirect=abc&token=xyz',
        data: { email: 'person@example.com', password: 'hunter2' },
        cookies: { session: 'abc' },
        headers: { authorization: 'Bearer x' },
        query_string: 'token=xyz',
      },
      user: { id: 42, email: 'person@example.com', ip_address: '1.2.3.4' },
      extra: { syncPayload: { doctor_notes: 'phi' }, attempt: 2 },
    });

    expect(event.request).toEqual({
      method: 'POST',
      url: 'https://api.test/auth/login',
    });
    expect(event.user).toEqual({ id: '42' });
    expect((event.extra as Record<string, unknown>)['syncPayload']).toBe(
      '[REDACTED]',
    );
    expect((event.extra as Record<string, unknown>)['attempt']).toBe(2);
    expect(JSON.stringify(event)).not.toContain('hunter2');
    expect(JSON.stringify(event)).not.toContain('person@example.com');
    expect(JSON.stringify(event)).not.toContain('Bearer');
  });

  it('omits the user entirely when there is no id', () => {
    const event = scrubEvent({ user: { email: 'person@example.com' } });
    expect(event.user).toBeUndefined();
  });

  it('reduces http breadcrumbs to method/status/query-less url', () => {
    const crumb = scrubBreadcrumb({
      category: 'http',
      data: {
        method: 'POST',
        status_code: 401,
        url: 'https://api.test/sync/push?since=5',
        request_body: '{"payload":"phi"}',
        response_body: '{"tokens":"x"}',
      },
    });

    expect(crumb.data).toEqual({
      method: 'POST',
      status_code: 401,
      url: 'https://api.test/sync/push',
    });
  });

  it('redacts data on non-http breadcrumbs', () => {
    const crumb = scrubBreadcrumb({
      category: 'console',
      data: { message: 'sync retry', refreshToken: 'r1' },
    });

    expect(crumb.data?.['refreshToken']).toBe('[REDACTED]');
    expect(crumb.data?.['message']).toBe('sync retry');
  });

  it('scrubs event breadcrumbs and tolerates absent fields', () => {
    const event = scrubEvent({
      breadcrumbs: [
        { category: 'http', data: { url: 'https://x/y?token=1' } },
        { message: 'ok' },
      ],
    });

    expect(event.breadcrumbs?.[0].data?.['url']).toBe('https://x/y');
    expect(scrubEvent({})).toEqual({ user: undefined });
  });

  it('stripQueryAndFragment handles non-string input', () => {
    expect(stripQueryAndFragment(undefined)).toBeUndefined();
    expect(stripQueryAndFragment(5)).toBeUndefined();
    expect(stripQueryAndFragment('https://a/b?c=1')).toBe('https://a/b');
  });

  // ADR-P026: the transactional-mail surface must never reach Sentry —
  // recipient addresses, subjects, rendered bodies, links, and either token
  // family. Redaction is key-based, so the field names are the contract.
  it('redacts the transactional-mail and password-recovery fields', () => {
    const redacted = redactDeep({
      userId: 'user-1',
      outcome: 'accepted',
      mailRecipient: 'person@example.com',
      recipient: 'person@example.com',
      subject: 'Reset your AppFitness password',
      textBody: 'click https://app.example.com/reset-password?token=raw',
      htmlBody:
        '<a href="https://app.example.com/reset-password?token=raw">x</a>',
      resetLink: 'https://app.example.com/reset-password?token=raw',
      resetToken: 'raw-reset-token',
      tokenHash: 'sha256hex',
      postmarkServerToken: 'server-token',
    }) as Record<string, unknown>;

    expect(redacted['userId']).toBe('user-1');
    expect(redacted['outcome']).toBe('accepted');
    for (const field of [
      'mailRecipient',
      'recipient',
      'subject',
      'textBody',
      'htmlBody',
      'resetLink',
      'resetToken',
      'tokenHash',
      'postmarkServerToken',
    ]) {
      expect(redacted[field]).toBe('[REDACTED]');
    }
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('person@example.com');
    expect(serialized).not.toContain('raw-reset-token');
    expect(serialized).not.toContain('token=raw');
  });

  it('keeps no rendered email anywhere in a scrubbed event', () => {
    const event = scrubEvent({
      extra: {
        htmlBody: '<p>Reset your password</p>',
        resetUrl: 'https://app.example.com/reset-password?token=raw',
      },
      tags: { recipientEmail: 'person@example.com' },
      contexts: { mail: { to: 'person@example.com' } },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('person@example.com');
    expect(serialized).not.toContain('token=raw');
    expect(serialized).not.toContain('Reset your password');
  });

  // ADR-P026 gate: the reset token lives in the URL **fragment**, so a
  // sanitizer that only stripped `?` would forward a live bearer credential
  // into a Sentry event. Everything from the earliest `?` or `#` must go.
  const RESET_SENTINEL = 'AbC123-reset-token-sentinel_XYZ';

  describe('stripQueryAndFragment', () => {
    it('strips a fragment carrying a reset token', () => {
      expect(
        stripQueryAndFragment(
          `https://app.example.com/reset-password#token=${RESET_SENTINEL}`,
        ),
      ).toBe('https://app.example.com/reset-password');
    });

    it('strips a query string carrying a reset token', () => {
      expect(
        stripQueryAndFragment(
          `https://app.example.com/reset-password?token=${RESET_SENTINEL}`,
        ),
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
