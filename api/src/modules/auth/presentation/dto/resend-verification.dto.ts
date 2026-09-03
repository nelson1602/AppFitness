import { IsIn, IsOptional, IsString } from 'class-validator';

import { MAIL_LOCALES } from '../../../mail/domain/mail.types';

/**
 * Body for `POST /auth/resend-verification`.
 *
 * Deliberately carries **no email address**. The route is authenticated and
 * acts on the caller's own account, which is what removes the enumeration
 * surface entirely — V2-B froze resend to the authenticated dashboard reminder
 * and defined no anonymous resend form, so there is no address to accept.
 */
export class ResendVerificationDto {
  /**
   * Language for the email body. A hint only: the client knows the active UI
   * language, and there is no server-side locale of record to read. Absent or
   * unknown values fall back to English.
   */
  @IsOptional()
  @IsString()
  @IsIn([...MAIL_LOCALES])
  locale?: string;
}
