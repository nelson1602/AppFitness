/**
 * Account password policy (ADR-P041 Decision 1).
 *
 * A password is accepted when it is 8–128 characters long and contains at
 * least one uppercase letter, one lowercase letter, one digit and one symbol.
 * The API enforces these exact rules in
 * `api/src/modules/auth/domain/password-policy.ts` so the live
 * checklist never disagrees with the server; both sides assert the same
 * vectors in their specs.
 *
 * Letters are detected by case mapping rather than an ASCII range so "Ñ" and
 * "á" count as letters, not symbols. A symbol is any character that is not a
 * letter, not a digit and not whitespace.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'symbol';

export const PASSWORD_RULES: readonly PasswordRule[] = [
  'length',
  'uppercase',
  'lowercase',
  'digit',
  'symbol',
];

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isUpper = (char: string): boolean => char !== char.toLowerCase();
const isLower = (char: string): boolean => char !== char.toUpperCase();
const isLetter = (char: string): boolean => isUpper(char) || isLower(char);
const isSymbol = (char: string): boolean => !isLetter(char) && !isDigit(char) && char.trim() !== '';

/** The rules the password does NOT yet satisfy, in display order. */
export function unmetPasswordRules(password: string): PasswordRule[] {
  const chars = Array.from(password);
  const met: Record<PasswordRule, boolean> = {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    uppercase: chars.some(isUpper),
    lowercase: chars.some(isLower),
    digit: chars.some(isDigit),
    symbol: chars.some(isSymbol),
  };
  return PASSWORD_RULES.filter((rule) => !met[rule]);
}

export function meetsPasswordPolicy(password: string): boolean {
  return unmetPasswordRules(password).length === 0;
}
