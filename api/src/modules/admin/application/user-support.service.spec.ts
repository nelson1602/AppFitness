import { USER_ACCOUNT_SELECT } from './user-support.service';

describe('backoffice user fields (ADR-P049: never health data)', () => {
  it('reads only account columns from users, and no relation', () => {
    expect(Object.keys(USER_ACCOUNT_SELECT).sort()).toEqual([
      'createdAt',
      'email',
      'emailVerifiedAt',
      'id',
      'status',
      'username',
    ]);
    for (const value of Object.values(USER_ACCOUNT_SELECT)) {
      expect(value).toBe(true);
    }
  });
});
