import type {
  DietaryPreferenceAttributes,
  DietaryPreferenceRecord,
  DietaryPreferenceUpdate,
} from './dietary-preference.types';

/**
 * Repository port (Dependency Inversion) for dietary_preferences. The
 * implementation owns persistence + field encryption; the handler owns
 * validation, ownership scoping, and conflict/version semantics.
 */
export abstract class DietaryPreferenceRepositoryPort {
  /** The row scoped to its owner (conflict detection + update/delete). */
  abstract findOwned(
    userId: string,
    id: string,
  ): Promise<DietaryPreferenceRecord | null>;
  abstract create(
    userId: string,
    id: string,
    attributes: DietaryPreferenceAttributes,
  ): Promise<DietaryPreferenceRecord>;
  /** Mutates kind + note only; the exclusion target is immutable. */
  abstract update(
    id: string,
    update: DietaryPreferenceUpdate,
    newVersion: number,
  ): Promise<void>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<DietaryPreferenceRecord[]>;
}
