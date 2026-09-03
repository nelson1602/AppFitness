import {
  isMailEnabled,
  isVerificationMailEnabled,
  parsePublicBaseUrl,
  resolveMailConfig,
} from './mail.config';

/**
 * ADR-P026: the mail configuration must fail closed. "Disabled" is an explicit,
 * honest state; a half-configured provider is a boot failure, never a silent
 * degradation into pretending mail was sent.
 */
describe('mail.config', () => {
  const postmarkEnv = {
    MAIL_PROVIDER: 'postmark',
    POSTMARK_SERVER_TOKEN: 'test-server-token',
    MAIL_FROM_ADDRESS: 'no-reply@mail.example.com',
    MAIL_PUBLIC_BASE_URL: 'https://app.example.com',
  } as NodeJS.ProcessEnv;

  describe('resolveMailConfig', () => {
    it('resolves to disabled when MAIL_PROVIDER is unset', () => {
      expect(resolveMailConfig({})).toEqual({ provider: 'disabled' });
    });

    it('resolves to disabled for an empty or whitespace value', () => {
      expect(resolveMailConfig({ MAIL_PROVIDER: '   ' })).toEqual({
        provider: 'disabled',
      });
    });

    it('resolves to disabled when explicitly disabled', () => {
      expect(resolveMailConfig({ MAIL_PROVIDER: 'disabled' })).toEqual({
        provider: 'disabled',
      });
    });

    it('resolves a fully configured postmark provider', () => {
      expect(resolveMailConfig(postmarkEnv)).toEqual({
        provider: 'postmark',
        serverToken: 'test-server-token',
        fromAddress: 'no-reply@mail.example.com',
        messageStream: 'outbound',
        publicBaseUrl: 'https://app.example.com',
        // Absent MAIL_VERIFICATION_BASE_URL resolves to null: verification mail
        // stays unavailable while password recovery keeps working (V2-C).
        verificationBaseUrl: null,
      });
    });

    it('honours an explicit transactional message stream', () => {
      const config = resolveMailConfig({
        ...postmarkEnv,
        POSTMARK_MESSAGE_STREAM: 'transactional',
      });
      expect(config).toMatchObject({ messageStream: 'transactional' });
    });

    it('lower-cases the sending address', () => {
      const config = resolveMailConfig({
        ...postmarkEnv,
        MAIL_FROM_ADDRESS: 'No-Reply@Mail.Example.COM',
      });
      expect(config).toMatchObject({
        fromAddress: 'no-reply@mail.example.com',
      });
    });

    it('rejects an unknown provider instead of falling back to disabled', () => {
      expect(() => resolveMailConfig({ MAIL_PROVIDER: 'sendgrid' })).toThrow(
        /Unsupported MAIL_PROVIDER/,
      );
    });

    it.each([
      ['POSTMARK_SERVER_TOKEN', /POSTMARK_SERVER_TOKEN is required/],
      ['MAIL_FROM_ADDRESS', /MAIL_FROM_ADDRESS is required/],
      ['MAIL_PUBLIC_BASE_URL', /MAIL_PUBLIC_BASE_URL is required/],
    ])('fails closed when %s is missing', (key, expected) => {
      const env = { ...postmarkEnv };
      delete env[key];
      expect(() => resolveMailConfig(env)).toThrow(expected);
    });

    it('fails closed on a malformed sending address', () => {
      expect(() =>
        resolveMailConfig({
          ...postmarkEnv,
          MAIL_FROM_ADDRESS: 'not-an-email',
        }),
      ).toThrow(/Invalid MAIL_FROM_ADDRESS/);
    });

    it('rejects a display-name or multi-recipient sending address', () => {
      expect(() =>
        resolveMailConfig({
          ...postmarkEnv,
          MAIL_FROM_ADDRESS: 'AppFitnessRD <no-reply@mail.example.com>',
        }),
      ).toThrow(/Invalid MAIL_FROM_ADDRESS/);
    });
  });

  describe('parsePublicBaseUrl', () => {
    it('accepts an https origin', () => {
      expect(parsePublicBaseUrl('https://app.example.com')).toBe(
        'https://app.example.com',
      );
    });

    it('preserves a base path and drops a single trailing slash', () => {
      expect(parsePublicBaseUrl('https://example.com/app/')).toBe(
        'https://example.com/app',
      );
    });

    it('refuses plain HTTP even for localhost — links are bearer credentials', () => {
      expect(() => parsePublicBaseUrl('http://localhost:8081')).toThrow(
        /must be https/,
      );
    });

    it('refuses a value carrying a query string', () => {
      expect(() => parsePublicBaseUrl('https://example.com?a=b')).toThrow(
        /query string or fragment/,
      );
    });

    it('refuses a value carrying a fragment', () => {
      expect(() => parsePublicBaseUrl('https://example.com#x')).toThrow(
        /query string or fragment/,
      );
    });

    it('refuses embedded credentials', () => {
      expect(() => parsePublicBaseUrl('https://user:pw@example.com')).toThrow(
        /Embedded credentials/,
      );
    });

    it('refuses a non-absolute value', () => {
      expect(() => parsePublicBaseUrl('app.example.com')).toThrow(
        /Expected an absolute https/,
      );
    });

    it('refuses an empty value', () => {
      expect(() => parsePublicBaseUrl('  ')).toThrow(/is required/);
    });
  });

  describe('isMailEnabled', () => {
    it('is false for the disabled provider', () => {
      expect(isMailEnabled({ provider: 'disabled' })).toBe(false);
    });

    it('is true for a configured provider', () => {
      expect(isMailEnabled(resolveMailConfig(postmarkEnv))).toBe(true);
    });
  });

  describe('verification base URL (ADR-P026 V2-C)', () => {
    const base = {
      MAIL_PROVIDER: 'postmark',
      POSTMARK_SERVER_TOKEN: 'test-server-token',
      MAIL_FROM_ADDRESS: 'no-reply@mail.example.com',
      MAIL_PUBLIC_BASE_URL: 'https://app.example.com',
    };

    it('is null when unset, so an already-enabled provider still boots', () => {
      // Deploy safety: every environment already running MAIL_PROVIDER=postmark
      // must keep booting after V2-C without a new variable being set first.
      expect(resolveMailConfig(base)).toMatchObject({
        verificationBaseUrl: null,
      });
      expect(isVerificationMailEnabled(resolveMailConfig(base))).toBe(false);
    });

    it('is null when set to whitespace only', () => {
      expect(
        resolveMailConfig({ ...base, MAIL_VERIFICATION_BASE_URL: '   ' }),
      ).toMatchObject({ verificationBaseUrl: null });
    });

    it('resolves and normalizes a valid https account host', () => {
      const config = resolveMailConfig({
        ...base,
        MAIL_VERIFICATION_BASE_URL: 'https://account.example.com/',
      });
      expect(config).toMatchObject({
        verificationBaseUrl: 'https://account.example.com',
      });
      expect(isVerificationMailEnabled(config)).toBe(true);
    });

    it('is independent of the recovery base — the two hosts differ on purpose', () => {
      expect(
        resolveMailConfig({
          ...base,
          MAIL_VERIFICATION_BASE_URL: 'https://account.example.com',
        }),
      ).toMatchObject({
        publicBaseUrl: 'https://app.example.com',
        verificationBaseUrl: 'https://account.example.com',
      });
    });

    it.each([
      ['plain http', 'http://account.example.com'],
      ['a query string', 'https://account.example.com?x=1'],
      ['a fragment', 'https://account.example.com#x'],
      ['embedded credentials', 'https://u:p@account.example.com'],
      ['a non-URL', 'not-a-url'],
    ])('throws when set but malformed (%s)', (_label, value) => {
      // Present-but-broken is NOT silently downgraded to disabled: the operator
      // clearly intended verification to work, and hiding the typo would only
      // surface later as mail that never arrives.
      expect(() =>
        resolveMailConfig({ ...base, MAIL_VERIFICATION_BASE_URL: value }),
      ).toThrow(/MAIL_VERIFICATION_BASE_URL/);
    });

    it('names the verification variable, not the recovery one, in its error', () => {
      let message = '';
      try {
        resolveMailConfig({
          ...base,
          MAIL_VERIFICATION_BASE_URL: 'http://account.example.com',
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain('MAIL_VERIFICATION_BASE_URL');
      expect(message).not.toContain('MAIL_PUBLIC_BASE_URL');
    });

    it('a disabled provider is never verification-enabled', () => {
      expect(isVerificationMailEnabled({ provider: 'disabled' })).toBe(false);
    });
  });
});
