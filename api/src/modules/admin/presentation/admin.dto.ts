import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

import { STAFF_PASSWORD_MAX } from '../domain/staff.types';

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

export class StaffLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(STAFF_PASSWORD_MAX * 4)
  password!: string;
}

export class TotpCodeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class InviteTokenDto {
  @Matches(TOKEN)
  token!: string;
}

export class AcceptInviteDto extends InviteTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(STAFF_PASSWORD_MAX * 4)
  password!: string;
}

export class ConfirmInviteDto extends InviteTokenDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class CreateStaffDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsUUID()
  roleId!: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;
}

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  permissions?: string[];
}

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class UserSearchQuery extends PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  q?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AuditQuery extends PageQuery {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class DeleteUserDto {
  @IsString()
  @MaxLength(320)
  confirmEmail!: string;
}
