import { UserStatus } from '@prisma/client';

import { csvCell, csvRow, EXPORT_COLUMNS } from './app-management.service';
import type { UserSummary } from './user-support.service';

describe('user CSV export (ADR-P049 amendment 1)', () => {
  it.each([
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+1', "'+1"],
    ['-2', "'-2"],
    ['@cmd', "'@cmd"],
    ['\tx', "'\tx"],
  ])('neutralizes formula injection in %p', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('quotes commas, quotes and newlines, and leaves plain text alone', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('ana@example.test')).toBe('ana@example.test');
    expect(csvCell(null)).toBe('');
    expect(csvCell(false)).toBe('false');
  });

  it('writes one row per user in the header order, account fields only', () => {
    const user: UserSummary = {
      id: 'u1',
      email: 'ana@example.test',
      username: 'ana',
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      emailVerified: true,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      deviceCount: 2,
      lastSyncAt: new Date('2026-11-20T08:00:00.000Z'),
      isPro: false,
    };
    expect(EXPORT_COLUMNS.join(',')).toBe(
      'id,email,username,created_at,email_verified,status,last_login_at,device_count,last_sync_at,is_pro',
    );
    expect(csvRow(user)).toBe(
      'u1,ana@example.test,ana,2026-11-01T10:00:00.000Z,true,ACTIVE,,2,2026-11-20T08:00:00.000Z,false',
    );
  });
});
