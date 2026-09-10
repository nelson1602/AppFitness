import { DatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';

import {
  WellnessProfileInvalid,
  type WellnessProfileInvalidReason,
} from '../domain/wellness-safety-profile.rules';
import {
  resolveMyWellnessDeclaration,
  resolveWellnessDeclaration,
} from './wellness-safety-consumption';

/**
 * ADR-P031 **W-4C**, test **D14** completeness.
 *
 * The sibling spec proves the end-to-end behaviour against a real database for
 * the corruptions a real row can carry. This one closes the remaining half of
 * D14 — *every* `WellnessProfileInvalid` reason yields `unavailable` — by
 * making the read fail with each reason in turn. Some of them (a future
 * evaluation date, a blank token) cannot be produced by writing to the shipped
 * schema, so a stub is the only way to enumerate the union exhaustively.
 *
 * The union is listed literally: adding a reason to the domain without deciding
 * how consumption answers it should fail here, not pass silently.
 */

const A = '11111111-1111-4111-8111-111111111111';

const mockGetProfile = jest.fn();
const mockListPayloads = jest.fn();

jest.mock('../infrastructure/wellness-safety-profile.repository', () => ({
  getWellnessSafetyProfile: (...args: unknown[]) => mockGetProfile(...args),
  listRelevantPendingWellnessConflictPayloads: (...args: unknown[]) => mockListPayloads(...args),
}));

const mockGetSession = jest.fn();
jest.mock('@/features/authentication', () => ({
  getSession: () => mockGetSession(),
}));

const ALL_REASONS: WellnessProfileInvalidReason[] = [
  'not-an-array',
  'not-an-object',
  'not-a-string',
  'blank-token',
  'unknown-token',
  'too-many-tokens',
  'date-required',
  'date-not-allowed',
  'date-malformed',
  'date-not-a-calendar-date',
  'date-in-the-future',
  'invalid-json',
  'invalid-boolean',
  'invalid-version',
  'invalid-timestamp',
  'missing-field',
  'owner-mismatch',
  'id-mismatch',
  'tombstone-inconsistent',
];

beforeEach(() => {
  mockGetProfile.mockReset();
  mockListPayloads.mockReset();
  mockGetSession.mockReset();
  mockListPayloads.mockResolvedValue([]);
});

describe('D14: every refusal reason becomes unavailable', () => {
  it('covers the whole reason union', () => {
    expect(new Set(ALL_REASONS).size).toBe(ALL_REASONS.length);
    expect(ALL_REASONS).toHaveLength(19);
  });

  it.each(ALL_REASONS)('a stored row refused as %s yields unavailable', async (reason) => {
    mockGetProfile.mockRejectedValue(new WellnessProfileInvalid(reason, 'movements_to_avoid'));

    // Never `absent`, and never a declaration with an empty movement list —
    // either of which would read as "this user declared no limitations".
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it.each(ALL_REASONS)('a conflict snapshot refused as %s yields unavailable', async (reason) => {
    mockGetProfile.mockResolvedValue(null);
    mockListPayloads.mockResolvedValue([JSON.stringify({ nope: reason })]);

    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it('a plain read failure — not a refusal — is unavailable too', async () => {
    mockGetProfile.mockRejectedValue(new Error('database is locked'));
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });

    mockGetProfile.mockResolvedValue(null);
    mockListPayloads.mockRejectedValue(new Error('database is locked'));
    expect(await resolveWellnessDeclaration(A)).toEqual({ status: 'unavailable' });
  });

  it('the outcome carries no reason, field or value', async () => {
    mockGetProfile.mockRejectedValue(
      new WellnessProfileInvalid('unknown-token', 'movements_to_avoid'),
    );

    const outcome = await resolveWellnessDeclaration(A);
    // A status, not a message: nothing a surface could accidentally render.
    expect(Object.keys(outcome)).toEqual(['status']);
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain('unknown-token');
    expect(serialized).not.toContain('movements_to_avoid');
  });
});

describe('what must NOT become unavailable', () => {
  it("Web's absent local database stays its own state (ADR-P019)", async () => {
    mockGetProfile.mockRejectedValue(new DatabaseUnsupportedOnWebError());

    // Flattening this into `unavailable` would tell a Web visitor their
    // declarations could not be read, when the truth is that Web has no local
    // database at all. The caller owns that state, so the error passes through.
    await expect(resolveWellnessDeclaration(A)).rejects.toBeInstanceOf(
      DatabaseUnsupportedOnWebError,
    );
  });

  it('a missing session is a programming error, not an outcome', async () => {
    mockGetSession.mockReturnValue(null);
    await expect(resolveMyWellnessDeclaration()).rejects.toThrow('Not authenticated');
  });

  it('the session form resolves for the authenticated owner', async () => {
    mockGetSession.mockReturnValue({ user: { id: A } });
    mockGetProfile.mockResolvedValue(null);

    expect(await resolveMyWellnessDeclaration()).toEqual({ status: 'absent' });
    expect(mockGetProfile).toHaveBeenCalledWith(A);
  });
});
