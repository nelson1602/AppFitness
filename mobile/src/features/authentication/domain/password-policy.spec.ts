import { meetsPasswordPolicy, unmetPasswordRules, type PasswordRule } from './password-policy';

/**
 * The same vectors are asserted by the API source of truth
 * (`api/src/modules/auth/domain/password-policy.spec.ts`) so the
 * live checklist and the server can never disagree.
 */
const VECTORS: readonly [string, PasswordRule[]][] = [
  ['', ['length', 'uppercase', 'lowercase', 'digit', 'symbol']],
  ['Ab1!xyz', ['length']],
  ['Ab1!xyzw', []],
  ['abcdef1!', ['uppercase']],
  ['ABCDEF1!', ['lowercase']],
  ['Abcdefg!', ['digit']],
  ['Abcdefg1', ['symbol']],
  ['Abcdef 1', ['symbol']],
  ['Ñandú-2026', []],
  ['ñandú2026', ['uppercase', 'symbol']],
  [`Ab1!${'x'.repeat(124)}`, []],
  [`Ab1!${'x'.repeat(125)}`, ['length']],
];

describe('password policy (ADR-P041 Decision 1)', () => {
  it.each(VECTORS)('%j fails exactly %j', (password, unmet) => {
    expect(unmetPasswordRules(password)).toEqual(unmet);
    expect(meetsPasswordPolicy(password)).toBe(unmet.length === 0);
  });
});
