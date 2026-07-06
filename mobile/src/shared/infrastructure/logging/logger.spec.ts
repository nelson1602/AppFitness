import { logError, logWarn, redactContext } from './logger';

type DevGlobal = { __DEV__: boolean };

describe('logger (TECHDEBT-003)', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    (globalThis as unknown as DevGlobal).__DEV__ = true;
  });

  it('surfaces the underlying error to the console in dev', () => {
    logError('dashboard.refresh', new Error('FOREIGN KEY constraint failed'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [scope, described] = errorSpy.mock.calls[0] as [string, string, unknown];
    expect(scope).toBe('[dashboard.refresh]');
    expect(described).toBe('Error: FOREIGN KEY constraint failed');
  });

  it('redacts sensitive-looking context keys, including nested ones', () => {
    logError('auth.signOut', new Error('boom'), {
      userId: 'user-1',
      accessToken: 'eyJ-very-secret',
      password: 'hunter2',
      doctorNotes: 'confidential medical text',
      request: { authorization: 'Bearer x', attempt: 2 },
    });

    const context = errorSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(context['userId']).toBe('user-1');
    expect(context['accessToken']).toBe('[REDACTED]');
    expect(context['password']).toBe('[REDACTED]');
    expect(context['doctorNotes']).toBe('[REDACTED]');
    expect((context['request'] as Record<string, unknown>)['authorization']).toBe('[REDACTED]');
    expect((context['request'] as Record<string, unknown>)['attempt']).toBe(2);
    expect(JSON.stringify(errorSpy.mock.calls[0])).not.toContain('eyJ-very-secret');
    expect(JSON.stringify(errorSpy.mock.calls[0])).not.toContain('hunter2');
    expect(JSON.stringify(errorSpy.mock.calls[0])).not.toContain('confidential');
  });

  it('emits nothing outside dev builds', () => {
    (globalThis as unknown as DevGlobal).__DEV__ = false;

    logError('dashboard.refresh', new Error('boom'));
    logWarn('sync.push', 'operation rejected');

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logWarn emits scope and message in dev', () => {
    logWarn('sync.push', 'operation rejected: goals/goal-1 (VALIDATION)');

    expect(warnSpy).toHaveBeenCalledWith(
      '[sync.push]',
      'operation rejected: goals/goal-1 (VALIDATION)',
      '',
    );
  });

  it('describes non-Error throwables without crashing', () => {
    logError('sync.pull', 'string failure');
    logError('sync.pull', { code: 500 });

    expect(errorSpy.mock.calls[0][1]).toBe('string failure');
    expect(errorSpy.mock.calls[1][1]).toBe('{"code":500}');
  });

  it('redactContext caps recursion depth defensively', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    const redacted = redactContext(deep);
    const level3 = ((redacted['a'] as Record<string, unknown>)['b'] as Record<string, unknown>)[
      'c'
    ] as Record<string, unknown>;
    expect(level3['d']).toBe('[MAX_DEPTH]');
  });
});
