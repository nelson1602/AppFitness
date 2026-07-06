import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PullQueryDto {
  /** Sync cursor: highest sync_seq the client has already pulled. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  since!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  /** Comma-separated entity type filter, e.g. ?entityTypes=goals,health_logs */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];
}
