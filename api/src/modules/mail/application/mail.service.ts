import { Inject, Injectable } from '@nestjs/common';

import {
  MAIL_CONFIG,
  isMailEnabled,
  isVerificationMailEnabled,
  type MailConfig,
} from '../../../config/mail.config';
import {
  MAIL_TRANSPORT,
  MailDisabledError,
  type MailLocale,
  type MailTransport,
} from '../domain/mail.types';
import { renderEmailVerificationEmail } from '../domain/email-verification.template';
import { renderPasswordResetEmail } from '../domain/password-reset.template';

/**
 * Composes transactional messages and hands them to the bound transport.
 *
 * Feature code calls the named method (`sendPasswordReset`) rather than
 * building a `MailMessage`, so template selection, locale handling and link
 * construction stay in one reviewable place. The vendor is never visible here.
 *
 * Link policy (ADR-P026 Decision 13): links are HTTPS URLs on the configured
 * public base, resolving to the app's Web fallback route.
 *
 * The token travels in the URL **fragment**, not the query string. A fragment
 * is never placed in the HTTP request-line, so it cannot reach the web
 * server's access log, an intermediary proxy log, or a `Referer` header sent
 * to a third party — all places a `?token=` bearer credential would otherwise
 * land in plaintext. The landing page reads it client-side and clears it from
 * the address bar and history.
 *
 * Operational consequence: the provider's **click tracking must stay off** for
 * this stream. A tracking redirect rewrites the href, and a rewritten URL is
 * not guaranteed to carry the fragment through — which would silently break
 * every reset link (see api/DEPLOYMENT.md).
 */

/** Path of the reset landing route; must match the mobile Expo Router route. */
export const PASSWORD_RESET_PATH = '/reset-password';

/**
 * Path of the verification landing route (ADR-P026 Vertical 2). Must match the
 * `/verify-email` Expo Router route that V2-D adds; until then the link
 * resolves to nothing, which is precisely why verification mail stays disabled
 * while `MAIL_VERIFICATION_BASE_URL` is unset.
 */
export const EMAIL_VERIFICATION_PATH = '/verify-email';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  /** False when no provider is configured; callers must answer "unavailable". */
  get enabled(): boolean {
    return isMailEnabled(this.config);
  }

  /** Name of the bound transport (diagnostics only — never a credential). */
  get transportName(): string {
    return this.transport.name;
  }

  /**
   * Build the HTTPS reset link. Throws when mail is disabled, because there is
   * no validated public base to build against — refusing beats emitting a
   * half-formed link.
   */
  passwordResetUrl(rawToken: string): string {
    if (this.config.provider === 'disabled') {
      throw new MailDisabledError();
    }
    const token = encodeURIComponent(rawToken);
    return `${this.config.publicBaseUrl}${PASSWORD_RESET_PATH}#token=${token}`;
  }

  /**
   * False when no transport is bound OR no verification base is configured.
   * Verification is gated separately from recovery so that an environment can
   * run password recovery in production while verification is still awaiting
   * its host (V2-E) — the two capabilities fail independently.
   */
  get verificationEnabled(): boolean {
    return isVerificationMailEnabled(this.config);
  }

  /**
   * Build the HTTPS verification link on the account host.
   *
   * Throws when verification mail is unavailable: with no validated base there
   * is no honest link to emit, and a half-formed or wrong-host link would send
   * users somewhere that cannot verify them. Callers check
   * `verificationEnabled` first.
   *
   * Same fragment policy as recovery — `#token=` never reaches a request line,
   * an access log, a proxy log, or a `Referer` header, and the same
   * click-tracking-must-stay-off constraint applies to this stream.
   */
  emailVerificationUrl(rawToken: string): string {
    if (
      this.config.provider === 'disabled' ||
      this.config.verificationBaseUrl === null
    ) {
      throw new MailDisabledError();
    }
    const token = encodeURIComponent(rawToken);
    return `${this.config.verificationBaseUrl}${EMAIL_VERIFICATION_PATH}#token=${token}`;
  }

  async sendEmailVerification(input: {
    to: string;
    locale: MailLocale;
    rawToken: string;
    expiresInHours: number;
  }): Promise<void> {
    const message = renderEmailVerificationEmail({
      to: input.to,
      locale: input.locale,
      verifyUrl: this.emailVerificationUrl(input.rawToken),
      expiresInHours: input.expiresInHours,
    });
    await this.transport.send(message);
  }

  async sendPasswordReset(input: {
    to: string;
    locale: MailLocale;
    rawToken: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const message = renderPasswordResetEmail({
      to: input.to,
      locale: input.locale,
      resetUrl: this.passwordResetUrl(input.rawToken),
      expiresInMinutes: input.expiresInMinutes,
    });
    await this.transport.send(message);
  }
}
