import { render } from '@testing-library/react-native';

import { AccessGateRedirect } from './access-gate-redirect';

let mockStatus: 'unknown' | 'authenticated' | 'unauthenticated' = 'authenticated';
let mockVerifiedAt: string | null = null;
let mockSegments: string[] = [];
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (href: string) => mockReplace(href) },
  useSegments: () => mockSegments,
}));

jest.mock('./use-session', () => ({
  useSession: () => ({
    status: mockStatus,
    session: mockStatus === 'authenticated' ? { user: { emailVerifiedAt: mockVerifiedAt } } : null,
  }),
}));

describe('AccessGateRedirect (ADR-P041 D2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'authenticated';
    mockVerifiedAt = null;
  });

  it.each([['(tabs)', 'nutrition'], ['food-log'], ['profile-edit']])(
    'moves an unverified account off %s',
    async (...segments) => {
      mockSegments = segments;
      await render(<AccessGateRedirect />);
      expect(mockReplace).toHaveBeenCalledWith('/verify-pending');
    },
  );

  it.each([['verify-pending'], ['verify-email']])(
    'leaves an unverified account on %s',
    async (...segments) => {
      mockSegments = segments;
      await render(<AccessGateRedirect />);
      expect(mockReplace).not.toHaveBeenCalled();
    },
  );

  it('never redirects a verified account', async () => {
    mockVerifiedAt = '2026-10-26T12:00:00.000Z';
    mockSegments = ['food-log'];
    await render(<AccessGateRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("leaves signed-out visitors to the routes' own guards", async () => {
    mockStatus = 'unauthenticated';
    mockSegments = ['food-log'];
    await render(<AccessGateRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
