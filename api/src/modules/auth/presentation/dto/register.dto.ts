import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MAIL_LOCALES } from '../../../mail/domain/mail.types';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may contain only letters, numbers, and underscores',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /**
   * Language for the automatic verification email (ADR-P026 Vertical 2).
   *
   * Optional and additive: existing clients that omit it keep working
   * unchanged and fall back to English. There is no profile to read a locale
   * from at registration time, so the client's active UI language is the only
   * available hint.
   */
  @IsOptional()
  @IsString()
  @IsIn([...MAIL_LOCALES])
  locale?: string;
}
