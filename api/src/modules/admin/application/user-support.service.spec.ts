import {
  likePattern,
  USER_ACCOUNT_SELECT,
  USER_SORT_FIELDS,
} from './user-support.service';

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

describe('backoffice user list sorting', () => {
  it('sorts by exactly the list columns', () => {
    expect([...USER_SORT_FIELDS].sort()).toEqual(
      [
        'createdAt',
        'deviceCount',
        'email',
        'emailVerified',
        'isPro',
        'lastLoginAt',
        'lastSyncAt',
        'status',
        'username',
      ].sort(),
    );
  });

  it('matches %, _ and \\ in a search term literally', () => {
    expect(likePattern('ana')).toBe('%ana%');
    expect(likePattern('50%_off\\x')).toBe('%50\\%\\_off\\\\x%');
  });
});
