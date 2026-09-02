import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { MAIL_LOCALES } from '../../../mail/domain/mail.types';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(320) // RFC 5321 maximum path length
  email!: string;

  /**
   * Language for the email body. A hint, not a preference of record: this is
   * an unauthenticated route, so there is no profile to read a locale from.
   * Absent or unknown values fall back to English.
   */
  @IsOptional()
  @IsString()
  @IsIn([...MAIL_LOCALES])
  locale?: string;
}
