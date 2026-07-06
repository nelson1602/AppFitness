import {
  EvaluationAttributes,
  EvaluationRecord,
  RestrictionAttributes,
  RestrictionRecord,
} from './medical.types';

/**
 * Repository ports (Dependency Inversion). Implementations own at-rest
 * encryption: domain records carry plaintext free-text, storage holds
 * only ciphertext (ADR-P006).
 *
 * Evaluations are APPEND-ONLY (.ai/04_DATABASE.md, .ai/07_ICOACH.md):
 * there is deliberately no update method — corrections are a new
 * evaluation plus a soft delete of the old one, both audited.
 */
export abstract class EvaluationRepositoryPort {
  abstract findOwned(
    userId: string,
    id: string,
  ): Promise<EvaluationRecord | null>;
  abstract listByUser(userId: string): Promise<EvaluationRecord[]>;
  abstract create(
    userId: string,
    attributes: Partial<EvaluationAttributes>,
    id?: string,
  ): Promise<EvaluationRecord>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<EvaluationRecord[]>;
}

export abstract class RestrictionRepositoryPort {
  abstract findOwned(
    userId: string,
    id: string,
  ): Promise<RestrictionRecord | null>;
  abstract listActive(userId: string): Promise<RestrictionRecord[]>;
  abstract create(
    userId: string,
    attributes: Partial<RestrictionAttributes>,
    id?: string,
  ): Promise<RestrictionRecord>;
  abstract update(
    id: string,
    attributes: Partial<RestrictionAttributes>,
    newVersion: number,
  ): Promise<RestrictionRecord>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RestrictionRecord[]>;
}
