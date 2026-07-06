import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}
