import { Logger } from '@nestjs/common';

import { MailDeliveryError } from '../domain/mail.types';
import { MailDispatcher } from './mail-dispatcher.service';

describe('MailDispatcher', () => {
  let dispatcher: MailDispatcher;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    dispatcher = new MailDispatcher();
    logSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns before the task settles, so the caller pays no provider latency', async () => {
    let started = false;
    let finished = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    dispatcher.dispatch('test', async () => {
      started = true;
      await gate;
      finished = true;
    });

    expect(started).toBe(true);
    expect(finished).toBe(false); // dispatch did not await the task

    release();
    await dispatcher.drain();
    expect(finished).toBe(true);
  });

  it('drains every in-flight dispatch', async () => {
    const done: number[] = [];
    for (const n of [1, 2, 3]) {
      dispatcher.dispatch('test', async () => {
        await Promise.resolve();
        done.push(n);
      });
    }

    await dispatcher.drain();
    expect(done.sort()).toEqual([1, 2, 3]);
  });

  it('drains tasks queued by other tasks', async () => {
    let inner = false;
    dispatcher.dispatch('outer', async () => {
      await Promise.resolve();
      dispatcher.dispatch('inner', async () => {
        await Promise.resolve();
        inner = true;
      });
    });

    await dispatcher.drain();
    expect(inner).toBe(true);
  });

  it('never lets a failed send reject into the caller', async () => {
    dispatcher.dispatch('auth.passwordReset', () =>
      Promise.reject(
        new MailDeliveryError('provider rejected the message (HTTP 500)'),
      ),
    );

    await expect(dispatcher.drain()).resolves.toBeUndefined();
  });

  it('logs a failure by error class only — never the recipient or the message', async () => {
    dispatcher.dispatch('auth.passwordReset', () =>
      Promise.reject(
        new MailDeliveryError(
          'provider rejected user@example.com token=raw-token',
        ),
      ),
    );
    await dispatcher.drain();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = String((logSpy.mock.calls[0] as [string])[0]);
    expect(logged).toContain('auth.passwordReset');
    expect(logged).toContain('MailDeliveryError');
    expect(logged).not.toContain('user@example.com');
    expect(logged).not.toContain('raw-token');
  });

  it('handles a non-Error rejection without leaking its value', async () => {
    // A non-Error rejection value (a bare string) must not be echoed into the
    // log. Cast so the lint rule sees an Error while the runtime value is not.
    const nonError = 'raw-token-leak' as unknown as Error;
    dispatcher.dispatch('test', () => Promise.reject(nonError));
    await dispatcher.drain();

    const logged = String((logSpy.mock.calls[0] as [string])[0]);
    expect(logged).toContain('unknown error');
    expect(logged).not.toContain('raw-token-leak');
  });

  it('drains on application shutdown so a deploy cannot sever an in-flight send', async () => {
    let sent = false;
    dispatcher.dispatch('auth.passwordReset', async () => {
      await Promise.resolve();
      sent = true;
    });

    await dispatcher.onApplicationShutdown();
    expect(sent).toBe(true);
  });

  it('drains cleanly when nothing was dispatched', async () => {
    await expect(dispatcher.drain()).resolves.toBeUndefined();
  });
});
