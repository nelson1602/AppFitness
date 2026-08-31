import type { MailLocale, MailMessage } from './mail.types';

/**
 * Password-reset email copy, EN and ES (ADR-P026 Vertical 1).
 *
 * Local templates — not provider-hosted ones — so the copy is reviewable in
 * the repository and CI can assert it without contacting a vendor. Pure
 * rendering: no clock, no config lookup, no I/O.
 *
 * Copy rules: state the expiry, say that ignoring the mail is safe, and never
 * confirm anything about the account beyond the fact that *someone* asked for
 * a reset (the request endpoint is enumeration-resistant; the email must not
 * undo that by leaking a username).
 */

interface PasswordResetInput {
  to: string;
  locale: MailLocale;
  resetUrl: string;
  expiresInMinutes: number;
}

/** Minimal HTML entity escaping for values interpolated into the HTML body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Copy {
  subject: string;
  heading: string;
  intro: string;
  action: string;
  expiry: (minutes: number) => string;
  ignore: string;
  fallback: string;
  signoff: string;
}

const COPY: Record<MailLocale, Copy> = {
  en: {
    subject: 'Reset your AppFitnessRD password',
    heading: 'Reset your password',
    intro:
      'We received a request to reset the password for this AppFitnessRD account.',
    action: 'Choose a new password',
    expiry: (minutes) =>
      `This link expires in ${minutes} minutes and can be used once.`,
    ignore:
      'If you did not request this, you can ignore this email — your password stays unchanged.',
    fallback: 'If the button does not work, copy this link into your browser:',
    signoff: 'The AppFitnessRD team',
  },
  es: {
    subject: 'Restablece tu contraseña de AppFitnessRD',
    heading: 'Restablece tu contraseña',
    intro:
      'Recibimos una solicitud para restablecer la contraseña de esta cuenta de AppFitnessRD.',
    action: 'Elegir una nueva contraseña',
    expiry: (minutes) =>
      `Este enlace caduca en ${minutes} minutos y solo puede usarse una vez.`,
    ignore:
      'Si no lo solicitaste, puedes ignorar este correo: tu contraseña no cambiará.',
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    signoff: 'El equipo de AppFitnessRD',
  },
};

/** Render the password-reset message for one recipient and locale. */
export function renderPasswordResetEmail(
  input: PasswordResetInput,
): MailMessage {
  const copy = COPY[input.locale];
  const expiry = copy.expiry(input.expiresInMinutes);
  const safeUrl = escapeHtml(input.resetUrl);

  const textBody = [
    copy.heading,
    '',
    copy.intro,
    '',
    `${copy.action}: ${input.resetUrl}`,
    '',
    expiry,
    copy.ignore,
    '',
    copy.signoff,
  ].join('\n');

  const htmlBody = [
    `<p><strong>${copy.heading}</strong></p>`,
    `<p>${copy.intro}</p>`,
    `<p><a href="${safeUrl}">${copy.action}</a></p>`,
    `<p>${expiry}</p>`,
    `<p>${copy.ignore}</p>`,
    `<p>${copy.fallback}<br>${safeUrl}</p>`,
    `<p>${copy.signoff}</p>`,
  ].join('\n');

  return {
    to: input.to,
    subject: copy.subject,
    textBody,
    htmlBody,
    templateId: 'password-reset',
    locale: input.locale,
  };
}
