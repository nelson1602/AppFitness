import { Prisma } from '@prisma/client';

import { scrubEvent, scrubText } from './sentry-scrub';
import { summarizeError } from './error-summary';

/** ADR-P046: errors and free text never carry values into logs or Sentry. */
describe('summarizeError', () => {
  it('reduces a Prisma error to its class name and code', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`) value ana@example.com',
      { code: 'P2002', clientVersion: 'test' },
    );
    expect(summarizeError(error)).toBe('PrismaClientKnownRequestError P2002');
  });

  it('keeps only the class name of any other error', () => {
    expect(summarizeError(new TypeError('secret value inside'))).toBe(
      'TypeError',
    );
    expect(summarizeError('a thrown string')).toBe('string');
  });
});

describe('Sentry free-text scrubbing', () => {
  it('replaces credentials, emails and quoted values, and cuts the length', () => {
    const text = scrubText(
      'Login for ana@example.com failed with "hunter2" Bearer abc.def ' +
        'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln and ' +
        'reset A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7 at https://x.test/r?token=1#t=2',
    ) as string;
    expect(text).not.toMatch(/ana@example\.com|hunter2|eyJ|A1b2C3|token=1|t=2/);
    expect(text).toContain('Bearer [REDACTED]');
    expect(text).toContain('https://x.test/r');
    expect(scrubText('x'.repeat(500))?.length).toBeLessThanOrEqual(201);
  });

  it('a Prisma exception keeps its class name only; others are scrubbed', () => {
    const event = scrubEvent({
      message: 'user ana@example.com',
      logentry: { message: 'saved "Mi nota médica"', params: ['x'] },
      exception: {
        values: [
          {
            type: 'PrismaClientKnownRequestError',
            value:
              'Invalid `prisma.user.create()` invocation: email ana@example.com',
          },
          { type: 'Error', value: 'failed for "Chicharrón de Ana"' },
        ],
      },
    });
    expect(event.exception.values[0].value).toBe(
      'PrismaClientKnownRequestError',
    );
    expect(event.exception.values[1].value).toBe('failed for [REDACTED]');
    expect(event.message).toBe('user [REDACTED]');
    expect(event.logentry).toEqual({ message: 'saved [REDACTED]' });
  });
});
