import { MAX_SCRUBBED_TEXT, scrubBreadcrumb, scrubEvent, scrubText } from './sentry-scrub';

/** ADR-P047 D7: the same free-text rule as the API (ADR-P046). */
describe('mobile scrubText / exception scrubbing', () => {
  it('removes emails, quoted values, JWTs, bearer and long tokens, URL query and fragment', () => {
    const text = scrubText(
      'Login for ana@example.com failed with "hunter2" Bearer abc.def ' +
        'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln and ' +
        'reset A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7 at https://x.test/r?token=1#t=2',
    ) as string;
    expect(text).not.toMatch(/ana@example\.com|hunter2|eyJ|A1b2C3|token=1|t=2/);
    expect(text).toContain('Bearer [REDACTED]');
    expect(text).toContain('https://x.test/r');
    expect(scrubText('x'.repeat(500))?.length).toBeLessThanOrEqual(MAX_SCRUBBED_TEXT + 1);
  });

  it('strips the token from the custom scheme too', () => {
    expect(scrubText('open appfitness://reset-password?token=abc123')).toBe(
      'open appfitness://reset-password',
    );
  });

  it('drops a SQLite error’s quoted values but keeps the constraint', () => {
    const text = scrubText(
      "NOT NULL constraint failed: body_weights.notes value 'me duele la rodilla'",
    );
    expect(text).toContain('NOT NULL constraint failed: body_weights.notes');
    expect(text).not.toContain('rodilla');
  });

  it('scrubs exception values, messages and log entries; keeps the exception type', () => {
    const event = scrubEvent({
      message: 'user ana@example.com',
      logentry: { message: 'saved "Mi nota médica"', params: ['Mi nota médica'] },
      exception: { values: [{ type: 'Error', value: 'failed for "Chicharrón de Ana"' }] },
    });
    expect(event.message).toBe('user [REDACTED]');
    expect(event.logentry).toEqual({ message: 'saved [REDACTED]' });
    expect(event.exception.values[0]).toEqual({ type: 'Error', value: 'failed for [REDACTED]' });
  });

  it('scrubs a console breadcrumb message', () => {
    const crumb = scrubBreadcrumb({ category: 'console', message: 'refresh for ana@example.com' });
    expect(crumb.message).toBe('refresh for [REDACTED]');
  });

  it('redacts the keys the API added (mail, subject, body, verif)', () => {
    const event = scrubEvent({
      extra: { verificationUrl: 'x', mailSubject: 'y', body: 'z', screen: 'ok' },
    });
    expect(event.extra).toEqual({
      verificationUrl: '[REDACTED]',
      mailSubject: '[REDACTED]',
      body: '[REDACTED]',
      screen: 'ok',
    });
  });
});
