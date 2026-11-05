import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  CUSTOM_SERVING_UNITS,
  type CustomServingUnit,
} from '../../application/food-search.service';
import type { ExternalFoodSource } from '../../catalog/external-food';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** No control characters in user-visible text. */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

export class FoodSearchQueryDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ImportFoodDto {
  @IsIn(['fdc', 'off'])
  source!: ExternalFoodSource;

  @IsString()
  @Matches(/^\d{1,24}$/, { message: 'sourceId must be a numeric source id' })
  sourceId!: string;
}

export class CreateCustomFoodDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  @Matches(NO_CONTROL_CHARS, { message: 'name contains invalid characters' })
  name!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(5000)
  servingAmount!: number;

  @IsIn(CUSTOM_SERVING_UNITS)
  servingUnit!: CustomServingUnit;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(5000)
  gramsPerServing?: number | null;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10000)
  caloriesPerServing!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  proteinPerServing!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  carbsPerServing!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  fatPerServing!: number;
}
