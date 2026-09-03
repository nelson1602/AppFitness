import { escapeHtml } from './password-reset.template';
import type { MailLocale, MailMessage } from './mail.types';

/**
 * Email-verification copy, EN and ES (ADR-P026 Vertical 2, V2-C).
 *
 * Local templates — not provider-hosted ones — so the copy is reviewable in
 * the repository and CI can assert it without contacting a vendor. Pure
 * rendering: no clock, no config lookup, no I/O.
 *
 * Copy rules, deliberately different from password recovery:
 * - **Nothing is at risk.** Verification is account hygiene, not a credential
 *   event, so the copy must not borrow recovery's alarmed tone or imply the
 *   account is in danger.
 * - **Do not claim recoverability.** Password recovery already works on an
 *   unverified address; saying verification "keeps your account recoverable"
 *   would be false (the same correction V2-B applied to the in-app copy).
 * - **Say what it actually does:** confirms this address belongs to the
 *   account and enables future email updates.
 * - **Ignoring it is safe and costs nothing** — the soft gate means core
 *   access is unaffected either way (Decision 11).
 * - State the 24-hour expiry and single use, exactly like recovery.
 *
 * This renders the EMAIL. In-app strings are the frozen `auth.verify.*` deck in
 * `.ai/19_COPY_DECKS.md`, which V2-D imports — the two are separate surfaces
 * and this file must not be treated as the source of those keys.
 */

interface EmailVerificationInput {
  to: string;
  locale: MailLocale;
  verifyUrl: string;
  expiresInHours: number;
}

interface Copy {
  subject: string;
  heading: string;
  intro: string;
  action: string;
  expiry: (hours: number) => string;
  ignore: string;
  fallback: string;
  signoff: string;
}

const COPY: Record<MailLocale, Copy> = {
  en: {
    subject: 'Verify your AppFitnessRD email address',
    heading: 'Verify your email',
    intro:
      'Verifying confirms this address belongs to your AppFitnessRD account and enables email updates when they arrive.',
    action: 'Verify this address',
    expiry: (hours) =>
      `This link expires in ${hours} hours and can be used once.`,
    ignore:
      'If you did not create this account, you can ignore this email. You can keep using the app either way — verifying is not required for access.',
    fallback: 'If the button does not work, copy this link into your browser:',
    signoff: 'The AppFitnessRD team',
  },
  es: {
    subject: 'Verifica tu correo de AppFitnessRD',
    heading: 'Verifica tu correo',
    intro:
      'Verificar confirma que esta dirección pertenece a tu cuenta de AppFitnessRD y habilita las novedades por correo cuando estén disponibles.',
    action: 'Verificar esta dirección',
    expiry: (hours) =>
      `Este enlace caduca en ${hours} horas y solo puede usarse una vez.`,
    ignore:
      'Si no creaste esta cuenta, puedes ignorar este correo. Puedes seguir usando la aplicación de todos modos: verificar no es obligatorio para acceder.',
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    signoff: 'El equipo de AppFitnessRD',
  },
};

/** Render the email-verification message for one recipient and locale. */
export function renderEmailVerificationEmail(
  input: EmailVerificationInput,
): MailMessage {
  const copy = COPY[input.locale];
  const expiry = copy.expiry(input.expiresInHours);
  const safeUrl = escapeHtml(input.verifyUrl);

  const textBody = [
    copy.heading,
    '',
    copy.intro,
    '',
    `${copy.action}: ${input.verifyUrl}`,
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
    templateId: 'email-verification',
    locale: input.locale,
  };
}
