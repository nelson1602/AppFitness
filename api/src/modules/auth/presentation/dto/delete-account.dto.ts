import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** ADR-P046: deleting the account requires the current password. */
export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
