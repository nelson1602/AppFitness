import type { ValidationArguments } from 'class-validator';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import {
  CONFLICT_RESOLUTIONS,
  type ConflictResolution,
  type ResolveConflictInput,
} from '../../domain/sync-conflict.types';

const OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;

@ValidatorConstraint({ name: 'resolutionPayloadShape', async: false })
class ResolutionPayloadShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ResolveConflictDto;
    if (dto.resolution === 'CLIENT_WINS') {
      return (
        OPERATIONS.some((operation) => operation === dto.operation) &&
        dto.payload !== undefined &&
        dto.payload !== null &&
        typeof dto.payload === 'object' &&
        !Array.isArray(dto.payload)
      );
    }
    if (dto.resolution === 'SERVER_WINS') {
      return dto.operation === undefined && dto.payload === undefined;
    }
    return false;
  }

  defaultMessage(): string {
    return 'CLIENT_WINS requires operation and payload; SERVER_WINS must omit both';
  }
}

export class ResolveConflictDto implements ResolveConflictInput {
  @IsIn(CONFLICT_RESOLUTIONS)
  @Validate(ResolutionPayloadShapeConstraint)
  resolution!: ConflictResolution;

  @IsInt()
  @Min(0)
  expectedServerVersion!: number;

  @IsBoolean()
  expectedDeleted!: boolean;

  @IsOptional()
  @IsIn(OPERATIONS)
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  correlationId?: string;
}
