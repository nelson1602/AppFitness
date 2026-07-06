import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { MedicalService } from '../application/medical.service';
import type {
  EvaluationRecord,
  RestrictionRecord,
} from '../domain/medical.types';
import {
  CreateEvaluationDto,
  CreateRestrictionDto,
} from './dto/create-evaluation.dto';

@ApiTags('medical')
@ApiBearerAuth()
@Controller('medical')
export class MedicalController {
  constructor(private readonly medicalService: MedicalService) {}

  @Get('evaluations')
  @ApiOperation({
    summary: 'List my medical/physical evaluations (newest first)',
  })
  listEvaluations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EvaluationRecord[]> {
    return this.medicalService.listEvaluations(user.id);
  }

  @Post('evaluations')
  @ApiOperation({
    summary: 'Record a new evaluation (append-only — no update exists)',
  })
  createEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEvaluationDto,
  ): Promise<EvaluationRecord> {
    return this.medicalService.createEvaluation(user.id, dto);
  }

  @Delete('evaluations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an evaluation (history preserved)' })
  async deleteEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.medicalService.deleteEvaluation(user.id, id);
  }

  @Get('restrictions')
  @ApiOperation({ summary: 'List my active medical restrictions' })
  listRestrictions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RestrictionRecord[]> {
    return this.medicalService.listActiveRestrictions(user.id);
  }

  @Post('restrictions')
  @ApiOperation({ summary: 'Record a medical restriction' })
  createRestriction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRestrictionDto,
  ): Promise<RestrictionRecord> {
    return this.medicalService.createRestriction(user.id, dto);
  }
}
