import {
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

import type { ActivityLevel } from '../../domain/medical.types';

export class CreateEvaluationDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'evaluationDate must be YYYY-MM-DD',
  })
  evaluationDate!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(700)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bodyFatPct?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(300)
  muscleMassKg?: number;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  bloodPressureSystolic?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  bloodPressureDiastolic?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  restingHeartRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  sleepQuality?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stressLevel?: number;

  @IsOptional()
  @IsIn(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'])
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  doctorNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  medications?: string;
}

export class CreateRestrictionDto {
  @IsIn(['INJURY', 'CONDITION', 'DOCTOR_RESTRICTION'])
  type!: 'INJURY' | 'CONDITION' | 'DOCTOR_RESTRICTION';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bodyArea?: string;

  @IsOptional()
  @IsIn(['MILD', 'MODERATE', 'SEVERE'])
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveUntil?: string;
}
