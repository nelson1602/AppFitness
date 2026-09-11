import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  isAlreadySatisfiedDelete,
  type SyncTx,
} from '../../sync/domain/sync.types';
import {
  DietaryPreferenceRepositoryPort,
  type DietaryPreferenceResolution,
} from '../domain/dietary-preference.repository';
import type {
  DietaryPreferenceAttributes,
  DietaryPreferenceRecord,
  DietaryPreferenceUpdate,
} from '../domain/dietary-preference.types';
import { FieldCipherService } from '../../medical/infrastructure/field-cipher.service';
import { dietaryPreferenceRowToRecord } from './dietary-preference.mapper';

/**
 * Prisma persistence for dietary_preferences (ADR-P014 Slice 2A). Owns
 * field-level encryption of the optional `note` (AES-256-GCM, ADR-P006);
 * `user_id` is always the authenticated owner (never the payload). `sync_seq`
 * is assigned by the DB trigger `trg_dietary_preferences_sync_seq`.
 *
 * ADR-P030 C-2: every write runs on the push operation's transaction client and
 * re-asserts owner + expected version + tombstone state in its own predicate.
 * `CREATE` is a static, entity-owned tagged-template statement with
 * `ON CONFLICT (id) DO NOTHING`, so an id collision reports `0` **without
 * raising** and leaves the transaction usable for the re-read and conflict row.
 * Every value is a driver parameter; no identifier is dynamic. Columns the
 * database owns (`created_at`, `version`, `sync_seq`) are omitted so their
 * defaults and the sync_seq trigger still apply; `updated_at` is `NOT NULL`
 * with no database default — Prisma supplies it from `@updatedAt` — so it is
 * written explicitly. Equivalence with Prisma's own `create` is asserted in
 * `test/sync-raw-create-equivalence.e2e-spec.ts`.
 */
@Injectable()
export class PrismaDietaryPreferenceRepository extends DietaryPreferenceRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipherService,
  ) {
    super();
  }

  async findOwned(
    tx: SyncTx,
    userId: string,
    id: string,
  ): Promise<DietaryPreferenceRecord | null> {
    const row = await tx.dietaryPreference.findFirst({ where: { id, userId } });
    return row ? dietaryPreferenceRowToRecord(row, this.cipher) : null;
  }

  async create(
    tx: SyncTx,
    userId: string,
    id: string,
    attributes: DietaryPreferenceAttributes,
  ): Promise<number> {
    // `attributes` is the total shape `parseDietaryPreferenceCreate` returns, so
    // no application default has to be re-derived here. The note is encrypted
    // before it reaches the statement; plaintext never appears in SQL.
    const noteEnc = this.encryptOrNull(attributes.note);
    return tx.$executeRaw`
      INSERT INTO dietary_preferences (
        id, user_id, exclusion_type, avoid_tag, catalog_key, kind,
        note_enc, enc_key_id, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${userId}::uuid,
        ${attributes.exclusionType},
        ${attributes.avoidTag},
        ${attributes.catalogKey},
        ${attributes.kind},
        ${noteEnc}::bytea,
        ${noteEnc ? this.cipher.keyId : null},
        ${new Date()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async update(
    tx: SyncTx,
    userId: string,
    id: string,
    update: DietaryPreferenceUpdate,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.dietaryPreference.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        ...this.mutableFields(update),
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async softDelete(
    tx: SyncTx,
    userId: string,
    id: string,
    deletedBy: string,
    expectedVersion: number,
  ): Promise<number> {
    const { count } = await tx.dietaryPreference.updateMany({
      where: { id, userId, version: expectedVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy,
        version: expectedVersion + 1,
      },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<DietaryPreferenceRecord[]> {
    const rows = await this.prisma.dietaryPreference.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map((row) => dietaryPreferenceRowToRecord(row, this.cipher));
  }

  async resolve(
    tx: SyncTx,
    userId: string,
    id: string,
    resolution: DietaryPreferenceResolution,
  ): Promise<number> {
    if (isAlreadySatisfiedDelete(resolution)) return 0;

    const fields: Prisma.DietaryPreferenceUpdateManyMutationInput =
      resolution.operation === 'DELETE'
        ? { deletedAt: new Date(), deletedBy: resolution.resolvedBy }
        : {
            // A retained CREATE resolves onto the row that already exists, so
            // it writes the same mutable subset an UPDATE does; the exclusion
            // target stays immutable either way.
            ...this.mutableFields(
              resolution.operation === 'CREATE'
                ? {
                    kind: resolution.attributes.kind,
                    note: resolution.attributes.note,
                  }
                : resolution.update,
            ),
            // A reviewed tombstone kept by the client is an explicit restore.
            ...(resolution.expectedDeleted
              ? { deletedAt: null, deletedBy: null }
              : {}),
          };

    const { count } = await tx.dietaryPreference.updateMany({
      where: {
        id,
        userId,
        version: resolution.expectedVersion,
        deletedAt: resolution.expectedDeleted ? { not: null } : null,
      },
      data: { ...fields, version: resolution.expectedVersion + 1 },
    });
    return count;
  }

  /** kind + note are the only mutable columns; note is re-encrypted in place. */
  private mutableFields(
    update: DietaryPreferenceUpdate,
  ): Prisma.DietaryPreferenceUpdateManyMutationInput {
    const noteEnc = this.encryptOrNull(update.note);
    return {
      kind: update.kind,
      noteEnc,
      encKeyId: noteEnc ? this.cipher.keyId : null,
    };
  }

  private encryptOrNull(plain: string | null): Uint8Array<ArrayBuffer> | null {
    return plain == null || plain === '' ? null : this.cipher.encrypt(plain);
  }
}
