import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /**
   * The raw token from the emailed link. A 32-byte base64url value is 43
   * characters; the bounds reject obvious junk cheaply without revealing the
   * exact expected length through a distinguishable error.
   */
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;

  /** Same policy as registration — recovery must not become a weaker path in. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
