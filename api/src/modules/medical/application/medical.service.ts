import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  EvaluationRepositoryPort,
  RestrictionRepositoryPort,
} from '../domain/medical.repository';
import {
  EvaluationAttributes,
  EvaluationRecord,
  RestrictionAttributes,
  RestrictionRecord,
} from '../domain/medical.types';

/**
 * Medical use cases for the REST surface. Evaluations are append-only:
 * create + soft-delete only, no update path exists anywhere.
 */
@Injectable()
export class MedicalService {
  constructor(
    private readonly evaluations: EvaluationRepositoryPort,
    private readonly restrictions: RestrictionRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  listEvaluations(userId: string): Promise<EvaluationRecord[]> {
    return this.evaluations.listByUser(userId);
  }

  async createEvaluation(
    userId: string,
    attributes: Partial<EvaluationAttributes>,
  ): Promise<EvaluationRecord> {
    const record = await this.evaluations.create(userId, attributes);
    await this.audit.record({
      action: AuditAction.MEDICAL_EVALUATION_CREATE,
      userId,
      entityType: 'medical_evaluations',
      entityId: record.id,
      metadata: { via: 'rest' },
    });
    return record;
  }

  async deleteEvaluation(userId: string, id: string): Promise<void> {
    const record = await this.evaluations.findOwned(userId, id);
    if (!record || record.deletedAt !== null) {
      throw new NotFoundException('Evaluation not found');
    }
    await this.evaluations.softDelete(id, userId, record.version + 1);
    await this.audit.record({
      action: AuditAction.MEDICAL_EVALUATION_DELETE,
      userId,
      entityType: 'medical_evaluations',
      entityId: id,
      metadata: { via: 'rest' },
    });
  }

  listActiveRestrictions(userId: string): Promise<RestrictionRecord[]> {
    return this.restrictions.listActive(userId);
  }

  async createRestriction(
    userId: string,
    attributes: Partial<RestrictionAttributes>,
  ): Promise<RestrictionRecord> {
    const record = await this.restrictions.create(userId, attributes);
    await this.audit.record({
      action: AuditAction.MEDICAL_RESTRICTION_CHANGE,
      userId,
      entityType: 'medical_restrictions',
      entityId: record.id,
      metadata: { via: 'rest', operation: 'CREATE' },
    });
    return record;
  }
}
