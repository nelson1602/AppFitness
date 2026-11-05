import * as authModule from '@/features/authentication';
import type { FakeSessionModule } from '@/features/authentication/testing/fake-session';
import { runSync } from '@/shared/infrastructure/sync';

import { checkEvaluationOwed } from './evaluation.service';
import { useEvaluationGate } from './evaluation-gate.store';

// The faithful in-memory session: a token rotation bumps the generation, as
// the real refreshTokens does.
jest.mock('@/features/authentication', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/features/authentication/testing/fake-session').createFakeSessionModule(),
);
const auth = authModule as unknown as FakeSessionModule;
jest.mock('@/shared/infrastructure/sync', () => ({ runSync: jest.fn() }));
jest.mock('@/shared/infrastructure/logging', () => ({ logError: jest.fn() }));
jest.mock('./evaluation.service', () => ({ checkEvaluationOwed: jest.fn() }));

beforeEach(() => {
  auth.becomeUser('u1');
  auth.refreshTokens.mockReset().mockResolvedValue(null);
  useEvaluationGate.setState({ status: 'unknown' });
  jest
    .mocked(runSync)
    .mockReset()
    .mockResolvedValue({ outcome: 'success' } as never);
  jest.mocked(checkEvaluationOwed).mockReset();
});

describe('useEvaluationGate (v8 Block 2 first run)', () => {
  it('lets an account with its evaluation into the app without syncing', async () => {
    jest.mocked(checkEvaluationOwed).mockResolvedValue(false);
    expect(await useEvaluationGate.getState().check()).toBe('done');
    expect(runSync).not.toHaveBeenCalled();
  });

  it('pulls once before asking a returning account on a fresh install', async () => {
    jest.mocked(checkEvaluationOwed).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await useEvaluationGate.getState().check()).toBe('done');
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  // v10 Block A: after a real token rotation the gate used to see its own run
  // as stale and answer 'unknown'.
  it('answers after an expired token is rotated during the pull', async () => {
    jest.mocked(checkEvaluationOwed).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    jest
      .mocked(runSync)
      .mockResolvedValueOnce({ outcome: 'unauthenticated' } as never)
      .mockResolvedValueOnce({ outcome: 'success' } as never);
    auth.refreshTokens.mockImplementation(async () => {
      const now = auth.getSession();
      if (!now) return null;
      return auth.rotateTo({ ...now, accessToken: 'rotated' });
    });
    expect(await useEvaluationGate.getState().check()).toBe('done');
    expect(runSync).toHaveBeenCalledTimes(2);
  });

  it('sends a new account to the evaluation', async () => {
    jest.mocked(checkEvaluationOwed).mockResolvedValue(true);
    expect(await useEvaluationGate.getState().check()).toBe('owed');
    expect(useEvaluationGate.getState().status).toBe('owed');
  });

  it('keeps the local answer when the pull fails offline', async () => {
    jest.mocked(checkEvaluationOwed).mockResolvedValue(true);
    jest.mocked(runSync).mockRejectedValue(new Error('offline'));
    expect(await useEvaluationGate.getState().check()).toBe('owed');
  });

  it('never locks the person out when the local read fails', async () => {
    jest.mocked(checkEvaluationOwed).mockRejectedValue(new Error('sqlite'));
    expect(await useEvaluationGate.getState().check()).toBe('done');
  });

  it('is done after the wizard saves', () => {
    useEvaluationGate.setState({ status: 'owed' });
    useEvaluationGate.getState().markDone();
    expect(useEvaluationGate.getState().status).toBe('done');
  });
});
