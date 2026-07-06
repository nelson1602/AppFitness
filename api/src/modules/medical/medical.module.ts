import { Module, OnModuleInit } from '@nestjs/common';

import { SyncEntityRegistry } from '../sync/domain/sync-entity-registry';
import { SyncModule } from '../sync/sync.module';
import { MedicalService } from './application/medical.service';
import {
  EvaluationRepositoryPort,
  RestrictionRepositoryPort,
} from './domain/medical.repository';
import { FieldCipherService } from './infrastructure/field-cipher.service';
import {
  EvaluationSyncHandler,
  RestrictionSyncHandler,
} from './infrastructure/medical-sync.handlers';
import {
  PrismaEvaluationRepository,
  PrismaRestrictionRepository,
} from './infrastructure/prisma-medical.repository';
import { MedicalController } from './presentation/medical.controller';

/**
 * Medical & Physical Evaluation module (Phase 8, ADR-0011/P006).
 * Free-text is AES-256-GCM encrypted at rest; evaluations are
 * append-only; conflict snapshots are redacted.
 */
@Module({
  imports: [SyncModule],
  controllers: [MedicalController],
  providers: [
    MedicalService,
    FieldCipherService,
    EvaluationSyncHandler,
    RestrictionSyncHandler,
    { provide: EvaluationRepositoryPort, useClass: PrismaEvaluationRepository },
    {
      provide: RestrictionRepositoryPort,
      useClass: PrismaRestrictionRepository,
    },
  ],
})
export class MedicalModule implements OnModuleInit {
  constructor(
    private readonly registry: SyncEntityRegistry,
    private readonly evaluationHandler: EvaluationSyncHandler,
    private readonly restrictionHandler: RestrictionSyncHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.evaluationHandler);
    this.registry.register(this.restrictionHandler);
  }
}
