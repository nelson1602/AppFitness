import { renderEmailVerificationEmail } from './email-verification.template';

/**
 * Copy and rendering contract for the verification email (ADR-P026 V2-C).
 *
 * These assertions are deliberately about *meaning*, not wording polish: the
 * template must state the expiry, must not borrow recovery's alarmed tone, and
 * must not repeat the "keeps your account recoverable" claim V2-B removed as
 * false (password recovery works on an unverified address).
 */
describe('email-verification template', () => {
  const base = {
    to: 'user@example.test',
    verifyUrl: 'https://account.example.test/verify-email#token=abc',
    expiresInHours: 24,
  };

  it('renders EN with the subject, link, expiry and single-use statement', () => {
    const message = renderEmailVerificationEmail({ ...base, locale: 'en' });

    expect(message.subject).toBe('Verify your AppFitnessRD email address');
    expect(message.templateId).toBe('email-verification');
    expect(message.locale).toBe('en');
    expect(message.to).toBe('user@example.test');
    expect(message.textBody).toContain(base.verifyUrl);
    expect(message.htmlBody).toContain(base.verifyUrl);
    expect(message.textBody).toContain('expires in 24 hours');
    expect(message.textBody).toContain('used once');
  });

  it('renders ES with translated subject and expiry', () => {
    const message = renderEmailVerificationEmail({ ...base, locale: 'es' });

    expect(message.subject).toBe('Verifica tu correo de AppFitnessRD');
    expect(message.locale).toBe('es');
    expect(message.textBody).toContain('caduca en 24 horas');
    expect(message.textBody).toContain(base.verifyUrl);
  });

  it('states that ignoring the email is safe and access is unaffected', () => {
    const en = renderEmailVerificationEmail({ ...base, locale: 'en' });
    // The soft gate (Decision 11): verification is never a precondition for use.
    expect(en.textBody).toContain('not required for access');

    const es = renderEmailVerificationEmail({ ...base, locale: 'es' });
    expect(es.textBody).toContain('no es obligatorio para acceder');
  });

  it('never claims verification affects password recovery', () => {
    for (const locale of ['en', 'es'] as const) {
      const body = renderEmailVerificationEmail({ ...base, locale });
      const text = `${body.textBody} ${body.htmlBody}`.toLowerCase();
      // V2-B removed this claim from the in-app copy as false; the email must
      // not reintroduce it.
      expect(text).not.toContain('recoverable');
      expect(text).not.toContain('recuperable');
      expect(text).not.toContain('password');
      expect(text).not.toContain('contraseña');
    }
  });

  it('escapes the link in the HTML body but leaves the text body raw', () => {
    const message = renderEmailVerificationEmail({
      ...base,
      locale: 'en',
      verifyUrl: 'https://account.example.test/verify-email#token=a&b"c',
    });

    expect(message.htmlBody).toContain('token=a&amp;b&quot;c');
    expect(message.htmlBody).not.toContain('token=a&b"c');
    expect(message.textBody).toContain('token=a&b"c');
  });
});
