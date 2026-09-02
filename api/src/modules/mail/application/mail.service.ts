import { Inject, Injectable } from '@nestjs/common';

import {
  MAIL_CONFIG,
  isMailEnabled,
  type MailConfig,
} from '../../../config/mail.config';
import {
  MAIL_TRANSPORT,
  MailDisabledError,
  type MailLocale,
  type MailTransport,
} from '../domain/mail.types';
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
