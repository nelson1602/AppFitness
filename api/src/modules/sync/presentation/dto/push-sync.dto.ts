import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PushOperationDto {
  @IsUUID()
  opId!: string;

  @IsString()
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  operation!: 'CREATE' | 'UPDATE' | 'DELETE';

  @IsInt()
  @Min(0)
  baseVersion!: number;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class PushSyncDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PushOperationDto)
  operations!: PushOperationDto[];
}
