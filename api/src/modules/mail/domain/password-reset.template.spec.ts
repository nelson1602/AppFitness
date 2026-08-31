import { resolveMailLocale } from './mail.types';
import {
  escapeHtml,
  renderPasswordResetEmail,
} from './password-reset.template';

const RESET_URL = 'https://app.example.com/reset-password#token=abc123';

describe('password-reset template', () => {
  it('renders English copy with the link, expiry and template id', () => {
    const message = renderPasswordResetEmail({
      to: 'user@example.com',
      locale: 'en',
      resetUrl: RESET_URL,
      expiresInMinutes: 30,
    });

    expect(message.to).toBe('user@example.com');
    expect(message.locale).toBe('en');
    expect(message.templateId).toBe('password-reset');
    expect(message.subject).toBe('Reset your AppFitnessRD password');
    expect(message.textBody).toContain(RESET_URL);
    expect(message.htmlBody).toContain('href=');
    expect(message.textBody).toContain('expires in 30 minutes');
    expect(message.textBody).toContain('used once');
  });

  it('renders Spanish copy for the es locale', () => {
    const message = renderPasswordResetEmail({
      to: 'user@example.com',
      locale: 'es',
      resetUrl: RESET_URL,
      expiresInMinutes: 30,
    });

    expect(message.locale).toBe('es');
    expect(message.subject).toBe('Restablece tu contraseña de AppFitnessRD');
    expect(message.textBody).toContain('caduca en 30 minutos');
    expect(message.textBody).toContain(RESET_URL);
  });

  it('tells the recipient that ignoring the email is safe, in both locales', () => {
    for (const locale of ['en', 'es'] as const) {
      const message = renderPasswordResetEmail({
        to: 'user@example.com',
        locale,
        resetUrl: RESET_URL,
        expiresInMinutes: 30,
      });
      const ignore =
        locale === 'en'
          ? 'you can ignore this email'
          : 'puedes ignorar este correo';
      expect(message.textBody).toContain(ignore);
      expect(message.htmlBody).toContain(ignore);
    }
  });

  it('never names the account beyond the recipient envelope', () => {
    // The request endpoint is enumeration-resistant; the email must not undo
    // that by naming a username or confirming account details.
    const message = renderPasswordResetEmail({
      to: 'user@example.com',
      locale: 'en',
      resetUrl: RESET_URL,
      expiresInMinutes: 30,
    });
    expect(message.textBody).not.toContain('user@example.com');
    expect(message.htmlBody).not.toContain('user@example.com');
  });

  it('escapes the URL when interpolating into HTML', () => {
    const message = renderPasswordResetEmail({
      to: 'user@example.com',
      locale: 'en',
      resetUrl: 'https://app.example.com/reset-password#token=a&b"><script>x',
      expiresInMinutes: 30,
    });

    expect(message.htmlBody).not.toContain('<script>');
    expect(message.htmlBody).toContain('&amp;b&quot;&gt;&lt;script&gt;');
  });

  describe('escapeHtml', () => {
    it('escapes the five significant characters', () => {
      expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    });
  });

  describe('resolveMailLocale', () => {
    it.each([
      ['en', 'en'],
      ['es', 'es'],
      ['ES', 'es'],
      ['es-MX', 'es'],
      ['en-US', 'en'],
    ])('maps %s to %s', (raw, expected) => {
      expect(resolveMailLocale(raw)).toBe(expected);
    });

    it.each([undefined, null, '', 'fr', 'zz'])(
      'falls back to English for %s',
      (raw) => {
        expect(resolveMailLocale(raw)).toBe('en');
      },
    );
  });
});
