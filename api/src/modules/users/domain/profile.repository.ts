import { ProfileAttributes, ProfileRecord } from './profile.types';

/**
 * Repository port (Dependency Inversion): the domain/application layers
 * depend on this abstraction; infrastructure provides the Prisma
 * implementation. Also serves as the Nest injection token.
 */
export abstract class ProfileRepositoryPort {
  abstract findByUserId(userId: string): Promise<ProfileRecord | null>;
  /** Ownership-scoped lookup — returns null for other users' rows. */
  abstract findOwned(userId: string, id: string): Promise<ProfileRecord | null>;
  abstract create(
    userId: string,
    attributes: Partial<ProfileAttributes>,
    id?: string,
  ): Promise<ProfileRecord>;
  /** Writes attributes and sets the row to `newVersion`. */
  abstract update(
    id: string,
    attributes: Partial<ProfileAttributes>,
    newVersion: number,
  ): Promise<ProfileRecord>;
  abstract softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void>;
  /** Rows (incl. tombstones) with sync_seq > sinceSeq, ascending, limited. */
  abstract changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProfileRecord[]>;
}
