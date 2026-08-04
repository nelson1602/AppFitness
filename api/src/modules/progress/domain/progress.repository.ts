import type {
  BodyMeasurementCreateInput,
  BodyMeasurementUpdateInput,
  BodyWeightCreateInput,
  BodyWeightUpdateInput,
} from './progress-payload';
import type { BodyMeasurementRecord, BodyWeightRecord } from './progress.types';

/**
 * Repository port for the Progress Monitoring write entities (ADR-P016 Slice
 * 3a). One port for the module; the implementation owns persistence only, while
 * handlers own validation/ownership. All writes carry the client-minted id and
 * the pipeline-provided new version; ownership/version conflicts are enforced by
 * the sync pipeline via `findOwned*` + baseVersion. These entities depend only
 * on user ownership (no parent entity), so there is no dependency probe.
 */
export abstract class ProgressRepositoryPort {
  // ── body_weights ──────────────────────────────────────────────────────────
  abstract findOwnedBodyWeight(
    userId: string,
    id: string,
  ): Promise<BodyWeightRecord | null>;
  abstract createBodyWeight(
    userId: string,
    id: string,
    data: BodyWeightCreateInput,
  ): Promise<BodyWeightRecord>;
  abstract updateBodyWeight(
    id: string,
    data: BodyWeightUpdateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteBodyWeight(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract bodyWeightsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyWeightRecord[]>;

  // ── body_measurements ───────────────────────────────────────────────────────
  abstract findOwnedBodyMeasurement(
    userId: string,
    id: string,
  ): Promise<BodyMeasurementRecord | null>;
  abstract createBodyMeasurement(
    userId: string,
    id: string,
    data: BodyMeasurementCreateInput,
  ): Promise<BodyMeasurementRecord>;
  abstract updateBodyMeasurement(
    id: string,
    data: BodyMeasurementUpdateInput,
    newVersion: number,
  ): Promise<void>;
  abstract softDeleteBodyMeasurement(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  abstract bodyMeasurementsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyMeasurementRecord[]>;
}
