import {
  redactDeep,
  scrubBreadcrumb,
  scrubEvent,
  stripQuery,
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

  it('stripQuery handles non-string input', () => {
    expect(stripQuery(undefined)).toBeUndefined();
    expect(stripQuery(5)).toBeUndefined();
    expect(stripQuery('https://a/b?c=1')).toBe('https://a/b');
  });
});
