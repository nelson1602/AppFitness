import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  ActivityLevel,
  FitnessLevel,
  Gender,
} from '../../domain/profile.types';

export class UpdateProfileDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'])
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  heightCm?: number;

  @IsOptional()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  fitnessLevel?: FitnessLevel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  yearsTraining?: number;

  @IsOptional()
  @IsIn(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'])
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  sleepHoursBaseline?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stressLevelBaseline?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  trainingDaysPerWeek?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(600)
  sessionDurationMins?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(20000)
  targetCalories?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  targetProteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  targetCarbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  targetFatG?: number;
}
