import type { MailMessage } from './mail.types';
import { escapeHtml } from './password-reset.template';

/**
 * Staff backoffice invite (ADR-P049). Spanish only: the backoffice UI is
 * Spanish. The link carries the one-time invite token in its fragment, like
 * the reset link, so it never reaches a request line, log or `Referer`.
 */
interface StaffInviteInput {
  to: string;
  inviteUrl: string;
  expiresInHours: number;
}

export function renderStaffInviteEmail(input: StaffInviteInput): MailMessage {
  const subject = 'Invitación al panel de administración de AppFitnessRD';
  const heading = 'Te invitaron al panel de administración';
  const intro =
    'Para activar tu cuenta, elige una contraseña y configura la verificación en dos pasos con una app de autenticación.';
  const action = 'Activar mi cuenta';
  const expiry = `Este enlace caduca en ${input.expiresInHours} horas y solo puede usarse una vez.`;
  const ignore =
    'Si no esperabas esta invitación, ignora este correo: no se creará ningún acceso.';
  const fallback =
    'Si el botón no funciona, copia este enlace en tu navegador:';
  const signoff = 'El equipo de AppFitnessRD';
  const safeUrl = escapeHtml(input.inviteUrl);

  const textBody = [
    heading,
    '',
    intro,
    '',
    `${action}: ${input.inviteUrl}`,
    '',
    expiry,
    ignore,
    '',
    signoff,
  ].join('\n');

  const htmlBody = [
    `<p><strong>${heading}</strong></p>`,
    `<p>${intro}</p>`,
    `<p><a href="${safeUrl}">${action}</a></p>`,
    `<p>${expiry}</p>`,
    `<p>${ignore}</p>`,
    `<p>${fallback}<br>${safeUrl}</p>`,
    `<p>${signoff}</p>`,
  ].join('\n');

  return {
    to: input.to,
    subject,
    textBody,
    htmlBody,
    templateId: 'staff-invite',
    locale: 'es',
  };
}
