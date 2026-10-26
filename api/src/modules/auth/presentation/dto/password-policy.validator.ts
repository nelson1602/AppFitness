import { ValidateBy, type ValidationOptions } from 'class-validator';

import { meetsPasswordPolicy } from '../../domain/password-policy';

/**
 * Validates a new account password against the shared policy (ADR-P041).
 *
 * Used by registration and password reset so recovery can never become a
 * weaker way in. Sign-in deliberately does NOT use it: accounts created
 * before the policy keep signing in with their existing password.
 *
 * The message names the policy, never the submitted value.
 */
export function IsAccountPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isAccountPassword',
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && meetsPasswordPolicy(value),
        defaultMessage: (): string =>
          'password must be 8-128 characters and include an uppercase letter, a lowercase letter, a number and a symbol',
      },
    },
    validationOptions,
  );
}
