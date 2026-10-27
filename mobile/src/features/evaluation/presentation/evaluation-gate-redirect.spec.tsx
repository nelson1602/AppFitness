import { render } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  EvaluationGateRedirect,
  isRouteAllowedWhileEvaluationOwed,
} from './evaluation-gate-redirect';

let mockSegment = 'dashboard';
let mockGate = 'owed';
let mockVerified: string | null = '2026-10-01T00:00:00.000Z';
const mockCheck = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useSegments: () => [mockSegment],
}));
jest.mock('@/features/authentication', () => ({
  useSession: () => ({
    status: 'authenticated',
    session: { user: { emailVerifiedAt: mockVerified } },
  }),
}));
jest.mock('../application/evaluation-gate.store', () => ({
  useEvaluationGate: (select: (state: Record<string, unknown>) => unknown) =>
    select({ status: mockGate, check: mockCheck }),
}));

beforeEach(() => {
  jest.mocked(router.replace).mockClear();
  mockCheck.mockClear();
  mockSegment = 'dashboard';
  mockGate = 'owed';
  mockVerified = '2026-10-01T00:00:00.000Z';
});

describe('EvaluationGateRedirect (v8 Block 2)', () => {
  it('allows only the evaluation, plan building and verification routes while owed', () => {
    expect(isRouteAllowedWhileEvaluationOwed('evaluation')).toBe(true);
    expect(isRouteAllowedWhileEvaluationOwed('plan-building')).toBe(true);
    expect(isRouteAllowedWhileEvaluationOwed('verify-email')).toBe(true);
    expect(isRouteAllowedWhileEvaluationOwed('(tabs)')).toBe(false);
    expect(isRouteAllowedWhileEvaluationOwed('food-log')).toBe(false);
    expect(isRouteAllowedWhileEvaluationOwed(undefined)).toBe(false);
  });

  it('sends a verified account that owes its evaluation to the wizard', async () => {
    mockSegment = 'food-log';
    await render(<EvaluationGateRedirect />);
    expect(router.replace).toHaveBeenCalledWith('/evaluation');
  });

  it('checks once the account is verified', async () => {
    mockGate = 'unknown';
    await render(<EvaluationGateRedirect />);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('leaves an unverified account to the email step', async () => {
    mockVerified = null;
    mockGate = 'unknown';
    await render(<EvaluationGateRedirect />);
    expect(mockCheck).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does nothing once the evaluation is done', async () => {
    mockGate = 'done';
    await render(<EvaluationGateRedirect />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
