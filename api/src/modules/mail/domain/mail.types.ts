/**
 * Transactional-mail port (ADR-P026 Decision 2).
 *
 * `MailTransport` is the only seam the rest of the API knows about, so the
 * vendor stays replaceable: Postmark today, a recorded fallback tomorrow, and
 * a fake in every test. Messages are fully rendered before they reach a
 * transport — a transport formats a request, it never composes copy.
 *
 * Nothing here carries a secret: the raw token lives only inside the rendered
 * link, and rendered messages are never logged or audited (Decision 9).
 */

/** DI token for the bound transport. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/** Locales with hand-written templates. Extend only with reviewed copy. */
export const MAIL_LOCALES = ['en', 'es'] as const;
export type MailLocale = (typeof MAIL_LOCALES)[number];

/** Stable ids used for test assertions and provider-side categorization. */
export const MAIL_TEMPLATE_IDS = ['password-reset'] as const;
export type MailTemplateId = (typeof MAIL_TEMPLATE_IDS)[number];

/**
 * Normalize a client-supplied locale hint. Unknown/absent values fall back to
 * English rather than failing — a recovery email in the wrong language is
 * still a recovery email, and the hint arrives on an unauthenticated route.
 */
export function resolveMailLocale(raw: string | undefined | null): MailLocale {
  const value = (raw ?? '').trim().toLowerCase().slice(0, 2);
  return (MAIL_LOCALES as readonly string[]).includes(value)
    ? (value as MailLocale)
    : 'en';
}

/** A fully rendered message, ready for a transport. */
export interface MailMessage {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  /** Which template produced this message (assertable in tests). */
  templateId: MailTemplateId;
  locale: MailLocale;
}

/** Provider-agnostic outbound-mail port. */
export interface MailTransport {
  /** Short identifier for diagnostics — never a credential. */
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/**
 * A send failed at the provider or on the wire. The message deliberately
 * carries no recipient, no body and no token — only a coarse cause, because
 * this string can reach logs and Sentry.
 */
export class MailDeliveryError extends Error {
  constructor(reason: string) {
    super(`Mail delivery failed: ${reason}`);
    this.name = 'MailDeliveryError';
  }
}

/**
 * A send was attempted while mail is globally disabled. Callers must check
 * availability first and answer "unavailable"; reaching this error means a
 * caller would otherwise have pretended an email was sent.
 */
export class MailDisabledError extends Error {
  constructor() {
    super('Mail is disabled: no transport is configured (MAIL_PROVIDER)');
    this.name = 'MailDisabledError';
  }
}
