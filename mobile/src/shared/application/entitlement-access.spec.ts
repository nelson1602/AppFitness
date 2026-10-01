type EntitlementAccessModule = typeof import('./entitlement-access');

const A = '00000000-0000-4000-8000-00000000aaaa';
const B = '00000000-0000-4000-8000-00000000bbbb';

/**
 * A fresh copy of the module-level projection per test. Production exposes no
 * reset API, so isolation is the only way to observe the initial state — the
 * same idiom as `session-storage.web.spec.ts`.
 */
function freshAccess(): EntitlementAccessModule {
  let access!: EntitlementAccessModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    access = require('./entitlement-access') as EntitlementAccessModule;
  });
  return access;
}

describe('entitlement access boundary', () => {
  let access: EntitlementAccessModule;

  beforeEach(() => {
    access = freshAccess();
  });

  it('starts unregulated, so a build that never configures enforcement is unchanged', () => {
    expect(access.getEntitlementAccess()).toEqual({ mode: 'unregulated', userId: null });
    expect(access.hasPaidMutationAccess(A)).toBe(true);
  });

  it('preserves current behaviour while provider enforcement is disabled', () => {
    access.configureEntitlementEnforcement(false);
    expect(access.hasPaidMutationAccess(A)).toBe(true);
    expect(() => access.assertPaidMutationAccess(A)).not.toThrow();
  });

  it('ignores session publications while unregulated', () => {
    access.beginEntitlementCheck(A);
    access.setEntitlementAccess(A, false);
    access.resetEntitlementAccess();

    expect(access.getEntitlementAccess()).toEqual({ mode: 'unregulated', userId: null });
  });

  it('fails closed while checking and when the provider reports inactive', () => {
    access.configureEntitlementEnforcement(true);
    access.beginEntitlementCheck(A);
    expect(() => access.assertPaidMutationAccess(A)).toThrow(access.EntitlementRequiredError);

    access.setEntitlementAccess(A, false);
    expect(access.getEntitlementAccess()).toEqual({ mode: 'read-only', userId: A });
    expect(() => access.assertPaidMutationAccess(A)).toThrow(access.EntitlementRequiredError);
  });

  it('authorizes only the owner whose active evidence was published', () => {
    access.configureEntitlementEnforcement(true);
    access.beginEntitlementCheck(A);
    access.setEntitlementAccess(A, true);

    expect(access.hasPaidMutationAccess(A)).toBe(true);
    expect(access.hasPaidMutationAccess(B)).toBe(false);
  });

  it('drops the prior account immediately and notifies subscribers', () => {
    const listener = jest.fn();
    access.subscribeEntitlementAccess(listener);
    access.configureEntitlementEnforcement(true);
    access.beginEntitlementCheck(A);
    access.setEntitlementAccess(A, true);

    access.resetEntitlementAccess();
    expect(access.getEntitlementAccess()).toEqual({ mode: 'checking', userId: null });
    expect(access.hasPaidMutationAccess(A)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('does not notify for an unchanged snapshot, and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = access.subscribeEntitlementAccess(listener);
    access.configureEntitlementEnforcement(false);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    access.configureEntitlementEnforcement(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
