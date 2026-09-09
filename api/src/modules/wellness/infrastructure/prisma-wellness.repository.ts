import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type { WellnessSafetyProfileWriteInput } from '../domain/wellness-payload';
import { WellnessRepositoryPort } from '../domain/wellness.repository';
import type { WellnessSafetyProfileRecord } from '../domain/wellness.types';
import { wellnessRowToRecord } from './wellness.mapper';

/**
 * Persistence for the Wellness Safety Profile (ADR-P017 W-2).
 *
 * Every statement is owner-scoped. Mutations use `updateMany` with
 * `{ id, userId }` rather than `update({ where: { id } })`: an id-only write
 * would succeed against another account's row, and the `count` it returns is
 * what lets the handler treat "not yours" as a failure instead of a no-op.
 * `userId` is always the authenticated user the pipeline passes in — a
 * client-supplied owner never reaches this layer.
 */
@Injectable()
export class PrismaWellnessRepository extends WellnessRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(
    userId: string,
    id: string,
  ): Promise<WellnessSafetyProfileRecord | null> {
    const row = await this.prisma.wellnessSafetyProfile.findFirst({
      where: { id, userId },
    });
    return row ? wellnessRowToRecord(row) : null;
  }

  async create(
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
  ): Promise<WellnessSafetyProfileRecord> {
    const row = await this.prisma.wellnessSafetyProfile.create({
      data: {
        id,
        userId,
        evaluationCompleted: data.evaluationCompleted,
        evaluationDate: data.evaluationDate,
        affectedAreas: data.affectedAreas,
        movementsToAvoid: data.movementsToAvoid,
      },
    });
    return wellnessRowToRecord(row);
  }

  async update(
    userId: string,
    id: string,
    data: WellnessSafetyProfileWriteInput,
    newVersion: number,
  ): Promise<number> {
    // No `deletedAt: null` filter: an UPDATE over a tombstone is the revive
    // path for this singleton, and the pipeline has already matched versions.
    const { count } = await this.prisma.wellnessSafetyProfile.updateMany({
      where: { id, userId },
      data: {
        evaluationCompleted: data.evaluationCompleted,
        evaluationDate: data.evaluationDate,
        affectedAreas: data.affectedAreas,
        movementsToAvoid: data.movementsToAvoid,
        version: newVersion,
        deletedAt: null,
        deletedBy: null,
      },
    });
    return count;
  }

  async softDelete(
    userId: string,
    id: string,
    newVersion: number,
    deletedAt: Date,
  ): Promise<number> {
    // `deletedAt` comes from the handler's single clock reading — this layer
    // never calls `new Date()`.
    const { count } = await this.prisma.wellnessSafetyProfile.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt, deletedBy: userId, version: newVersion },
    });
    return count;
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<WellnessSafetyProfileRecord[]> {
    const rows = await this.prisma.wellnessSafetyProfile.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(wellnessRowToRecord);
  }
}
