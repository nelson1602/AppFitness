import type {
  DisabledMailConfig,
  PostmarkMailConfig,
} from '../../../config/mail.config';
import { MailDisabledError } from '../domain/mail.types';
import { DisabledMailTransport } from '../infrastructure/disabled.transport';
import { FakeMailTransport } from '../infrastructure/fake.transport';
import { MailService } from './mail.service';

const ENABLED: PostmarkMailConfig = {
  provider: 'postmark',
  serverToken: 'token',
  fromAddress: 'no-reply@mail.example.com',
  messageStream: 'outbound',
  publicBaseUrl: 'https://app.example.com',
  verificationBaseUrl: 'https://account.example.com',
};

const DISABLED: DisabledMailConfig = { provider: 'disabled' };

describe('MailService', () => {
  describe('when a provider is configured', () => {
    let transport: FakeMailTransport;
    let service: MailService;

    beforeEach(() => {
      transport = new FakeMailTransport();
      service = new MailService(ENABLED, transport);
    });

    it('reports itself enabled', () => {
      expect(service.enabled).toBe(true);
      expect(service.transportName).toBe('fake');
    });

    it('builds an HTTPS reset link carrying the token in the FRAGMENT', () => {
      expect(service.passwordResetUrl('raw-token')).toBe(
        'https://app.example.com/reset-password#token=raw-token',
      );
    });

    it('percent-encodes the token so it cannot break out of the fragment', () => {
      expect(service.passwordResetUrl('a+b/c=d&e')).toBe(
        'https://app.example.com/reset-password#token=a%2Bb%2Fc%3Dd%26e',
      );
    });

    // ADR-P026 correction: the token must never sit in a query string. A
    // query string reaches the web server, every reverse proxy in front of it,
    // and any `Referer` header the landing page emits — so a `?token=` link
    // deposits a live bearer credential in plaintext access logs.
    it('never places the token in the query string, only after the # separator', () => {
      const url = service.passwordResetUrl('raw-token');

      expect(url).not.toContain('?token=');
      expect(url).not.toContain('?');
      const [beforeFragment, ...fragment] = url.split('#');
      expect(beforeFragment).toBe('https://app.example.com/reset-password');
      expect(beforeFragment).not.toContain('raw-token');
      expect(fragment.join('#')).toBe('token=raw-token');
    });

    it('keeps the token out of the request-line portion even with a base path', () => {
      const scoped = new MailService(
        { ...ENABLED, publicBaseUrl: 'https://example.com/app' },
        transport,
      );

      const requestLine = scoped.passwordResetUrl('secret-value').split('#')[0];
      expect(requestLine).not.toContain('secret-value');
    });
    it('honours a base path in the public base URL', () => {
      const scoped = new MailService(
        { ...ENABLED, publicBaseUrl: 'https://example.com/app' },
        transport,
      );
      expect(scoped.passwordResetUrl('t')).toBe(
        'https://example.com/app/reset-password#token=t',
      );
    });

    it('sends a rendered password-reset message through the transport', async () => {
      await service.sendPasswordReset({
        to: 'user@example.com',
        locale: 'es',
        rawToken: 'raw-token',
        expiresInMinutes: 30,
      });

      const sent = transport.last();
      expect(sent).toBeDefined();
      expect(sent?.to).toBe('user@example.com');
      expect(sent?.locale).toBe('es');
      expect(sent?.templateId).toBe('password-reset');
      // The raw token exists ONLY inside the link.
      expect(sent?.textBody).toContain(
        'https://app.example.com/reset-password#token=raw-token',
      );
    });
  });

  describe('when mail is globally disabled', () => {
    let service: MailService;

    beforeEach(() => {
      service = new MailService(DISABLED, new DisabledMailTransport());
    });

    it('reports itself disabled', () => {
      expect(service.enabled).toBe(false);
    });

    it('refuses to build a link rather than emitting a half-formed one', () => {
      expect(() => service.passwordResetUrl('raw-token')).toThrow(
        MailDisabledError,
      );
    });

    it('rejects a send instead of silently pretending it succeeded', async () => {
      await expect(
        service.sendPasswordReset({
          to: 'user@example.com',
          locale: 'en',
          rawToken: 'raw-token',
          expiresInMinutes: 30,
        }),
      ).rejects.toBeInstanceOf(MailDisabledError);
    });
  });
});

describe('FakeMailTransport', () => {
  it('records every message and can be reset between tests', async () => {
    const transport = new FakeMailTransport();
    const message = {
      to: 'a@b.test',
      subject: 's',
      textBody: 't',
      htmlBody: 'h',
      templateId: 'password-reset' as const,
      locale: 'en' as const,
    };

    await transport.send(message);
    await transport.send({ ...message, to: 'c@d.test' });

    expect(transport.sent).toHaveLength(2);
    expect(transport.last()?.to).toBe('c@d.test');

    transport.reset();
    expect(transport.sent).toHaveLength(0);
    expect(transport.last()).toBeUndefined();
  });
});

describe('DisabledMailTransport', () => {
  it('rejects — a no-op would report success for mail that never left', async () => {
    await expect(new DisabledMailTransport().send()).rejects.toBeInstanceOf(
      MailDisabledError,
    );
  });

  describe('email verification (ADR-P026 V2-C)', () => {
    let transport: FakeMailTransport;
    let service: MailService;

    beforeEach(() => {
      transport = new FakeMailTransport();
      service = new MailService(ENABLED, transport);
    });

    it('builds the link on the ACCOUNT host with the token in the FRAGMENT', () => {
      const url = service.emailVerificationUrl('raw-token');

      expect(url).toBe(
        'https://account.example.com/verify-email#token=raw-token',
      );
      // A fragment never reaches a request line, an access log, a proxy log,
      // or a Referer header — the same reason recovery uses one.
      expect(url).not.toContain('?');
    });

    it('serves verification from a different host than recovery', () => {
      expect(new URL(service.emailVerificationUrl('t')).host).not.toBe(
        new URL(service.passwordResetUrl('t')).host,
      );
    });

    it('percent-encodes the token so it cannot break out of the fragment', () => {
      expect(service.emailVerificationUrl('a+b/c=d&e')).toBe(
        'https://account.example.com/verify-email#token=a%2Bb%2Fc%3Dd%26e',
      );
    });

    it('reports enabled and sends a rendered verification message', async () => {
      expect(service.verificationEnabled).toBe(true);

      await service.sendEmailVerification({
        to: 'user@example.test',
        locale: 'en',
        rawToken: 'raw-token',
        expiresInHours: 24,
      });

      const sent = transport.last();
      expect(sent?.templateId).toBe('email-verification');
      expect(sent?.to).toBe('user@example.test');
      expect(sent?.textBody).toContain(
        'https://account.example.com/verify-email#token=raw-token',
      );
    });

    it('fails closed without a verification base, leaving recovery untouched', () => {
      const partial = new MailService(
        { ...ENABLED, verificationBaseUrl: null },
        transport,
      );

      expect(partial.verificationEnabled).toBe(false);
      expect(() => partial.emailVerificationUrl('t')).toThrow(
        MailDisabledError,
      );
      // The two capabilities fail independently — recovery still works.
      expect(partial.enabled).toBe(true);
      expect(() => partial.passwordResetUrl('t')).not.toThrow();
    });

    it('is disabled when no transport is bound at all', () => {
      const off = new MailService(DISABLED, new DisabledMailTransport());
      expect(off.verificationEnabled).toBe(false);
      expect(() => off.emailVerificationUrl('t')).toThrow(MailDisabledError);
    });
  });
});
