import type { ExecutionContext } from '@nestjs/common';

import type { EntitlementAuthorizationService } from '../../application/entitlement-authorization.service';
import { ActiveEntitlementGuard } from './active-entitlement.guard';

const USER_ID = '00000000-0000-4000-8000-00000000aaaa';

describe('ActiveEntitlementGuard', () => {
  const assertPaidMutationAllowed = jest.fn();
  const authorization = {
    assertPaidMutationAllowed,
  } as unknown as EntitlementAuthorizationService;

  beforeEach(() => jest.clearAllMocks());

  it('authorizes from the authenticated server identity only', async () => {
    const guard = new ActiveEntitlementGuard(authorization);

    await expect(guard.canActivate(contextWithUser(USER_ID))).resolves.toBe(
      true,
    );
    expect(assertPaidMutationAllowed).toHaveBeenCalledWith(USER_ID);
  });

  it('rejects when no authenticated identity reached the guard', async () => {
    const guard = new ActiveEntitlementGuard(authorization);

    await expect(
      guard.canActivate(contextWithUser(null)),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(assertPaidMutationAllowed).not.toHaveBeenCalled();
  });
});

function contextWithUser(userId: string | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => (userId ? { user: { id: userId } } : {}),
    }),
  } as unknown as ExecutionContext;
}
