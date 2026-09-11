import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

function toArray(value: unknown): unknown {
  if (typeof value === 'string') return value.split(',').filter(Boolean);
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (const item of value) {
      if (typeof item === 'string')
        result.push(...item.split(',').filter(Boolean));
      else result.push(item);
    }
    return result;
  }
  return value;
}

export class ListConflictsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  /** Locally-known unsettled conflict ids; status-only reconciliation. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ids?: string[];
}
