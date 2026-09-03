import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  /**
   * The raw token from the emailed link. A 32-byte base64url value is 43
   * characters; the bounds reject obvious junk cheaply without revealing the
   * exact expected length through a distinguishable error — the same shape the
   * shipped reset DTO uses.
   */
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;
}
