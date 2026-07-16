import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { DietaryPreferenceRepositoryPort } from '../domain/dietary-preference.repository';
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
    userId: string,
    id: string,
  ): Promise<DietaryPreferenceRecord | null> {
    const row = await this.prisma.dietaryPreference.findFirst({
      where: { id, userId },
    });
    return row ? dietaryPreferenceRowToRecord(row, this.cipher) : null;
  }

  async create(
    userId: string,
    id: string,
    attributes: DietaryPreferenceAttributes,
  ): Promise<DietaryPreferenceRecord> {
    const row = await this.prisma.dietaryPreference.create({
      data: {
        id, // client-minted PK
        userId, // authenticated owner only — never from payload
        exclusionType: attributes.exclusionType,
        avoidTag: attributes.avoidTag,
        catalogKey: attributes.catalogKey,
        kind: attributes.kind,
        noteEnc: this.encryptOrNull(attributes.note),
        encKeyId: attributes.note ? this.cipher.keyId : null,
      },
    });
    return dietaryPreferenceRowToRecord(row, this.cipher);
  }

  async update(
    id: string,
    update: DietaryPreferenceUpdate,
    newVersion: number,
  ): Promise<void> {
    const data: Prisma.DietaryPreferenceUpdateInput = {
      kind: update.kind,
      version: newVersion,
      noteEnc: this.encryptOrNull(update.note),
      encKeyId: update.note ? this.cipher.keyId : null,
    };
    await this.prisma.dietaryPreference.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.dietaryPreference.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
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

  private encryptOrNull(plain: string | null): Uint8Array<ArrayBuffer> | null {
    return plain == null || plain === '' ? null : this.cipher.encrypt(plain);
  }
}
