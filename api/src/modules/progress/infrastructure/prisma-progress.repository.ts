import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import type {
  BodyMeasurementCreateInput,
  BodyMeasurementUpdateInput,
  BodyWeightCreateInput,
  BodyWeightUpdateInput,
  ProgressSnapshotCreateInput,
  ProgressSnapshotUpdateInput,
} from '../domain/progress-payload';
import { ProgressRepositoryPort } from '../domain/progress.repository';
import type {
  BodyMeasurementRecord,
  BodyWeightRecord,
  ProgressSnapshotRecord,
} from '../domain/progress.types';
import {
  bodyMeasurementRowToRecord,
  bodyWeightRowToRecord,
  progressSnapshotRowToRecord,
} from './progress.mapper';

/** Persistence for the Progress Monitoring write entities (ADR-P016 Slice 3a). */
@Injectable()
export class PrismaProgressRepository extends ProgressRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── body_weights ──────────────────────────────────────────────────────────
  async findOwnedBodyWeight(
    userId: string,
    id: string,
  ): Promise<BodyWeightRecord | null> {
    const r = await this.prisma.bodyWeight.findFirst({ where: { id, userId } });
    return r ? bodyWeightRowToRecord(r) : null;
  }

  async createBodyWeight(
    userId: string,
    id: string,
    data: BodyWeightCreateInput,
  ): Promise<BodyWeightRecord> {
    // user_id is set server-side from the authenticated user, never trusted
    // from the payload. A duplicate (user_id, date) violates the DB unique
    // constraint and surfaces as an apply failure (never a silent overwrite).
    const r = await this.prisma.bodyWeight.create({
      data: {
        id,
        userId,
        weightKg: data.weightKg,
        date: data.date,
        notes: data.notes,
      },
    });
    return bodyWeightRowToRecord(r);
  }

  async updateBodyWeight(
    id: string,
    data: BodyWeightUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.bodyWeight.update({
      where: { id },
      data: {
        weightKg: data.weightKg,
        date: data.date,
        notes: data.notes,
        version: newVersion,
      },
    });
  }

  async softDeleteBodyWeight(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.bodyWeight.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async bodyWeightsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyWeightRecord[]> {
    const rows = await this.prisma.bodyWeight.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(bodyWeightRowToRecord);
  }

  // ── body_measurements ───────────────────────────────────────────────────────
  async findOwnedBodyMeasurement(
    userId: string,
    id: string,
  ): Promise<BodyMeasurementRecord | null> {
    const r = await this.prisma.bodyMeasurement.findFirst({
      where: { id, userId },
    });
    return r ? bodyMeasurementRowToRecord(r) : null;
  }

  async createBodyMeasurement(
    userId: string,
    id: string,
    data: BodyMeasurementCreateInput,
  ): Promise<BodyMeasurementRecord> {
    const r = await this.prisma.bodyMeasurement.create({
      data: {
        id,
        userId,
        date: data.date,
        bodyFatPct: data.bodyFatPct,
        muscleMassKg: data.muscleMassKg,
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        leftArmCm: data.leftArmCm,
        rightArmCm: data.rightArmCm,
        neckCm: data.neckCm,
        notes: data.notes,
      },
    });
    return bodyMeasurementRowToRecord(r);
  }

  async updateBodyMeasurement(
    id: string,
    data: BodyMeasurementUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.bodyMeasurement.update({
      where: { id },
      data: {
        date: data.date,
        bodyFatPct: data.bodyFatPct,
        ...(data.muscleMassKg !== undefined
          ? { muscleMassKg: data.muscleMassKg }
          : {}),
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        leftArmCm: data.leftArmCm,
        rightArmCm: data.rightArmCm,
        neckCm: data.neckCm,
        notes: data.notes,
        version: newVersion,
      },
    });
  }

  async softDeleteBodyMeasurement(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.bodyMeasurement.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async bodyMeasurementsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<BodyMeasurementRecord[]> {
    const rows = await this.prisma.bodyMeasurement.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(bodyMeasurementRowToRecord);
  }

  // ── progress_snapshots (Slice 4b) ─────────────────────────────────────────
  async findOwnedProgressSnapshot(
    userId: string,
    id: string,
  ): Promise<ProgressSnapshotRecord | null> {
    const r = await this.prisma.progressSnapshot.findFirst({
      where: { id, userId },
    });
    return r ? progressSnapshotRowToRecord(r) : null;
  }

  async createProgressSnapshot(
    userId: string,
    id: string,
    data: ProgressSnapshotCreateInput,
  ): Promise<ProgressSnapshotRecord> {
    // Client-minted id is honored; user_id is server-assigned. A duplicate
    // (user_id, week_start, rule_version) violates the DB unique constraint and
    // surfaces as an apply failure (never a silent overwrite). The backend
    // stores the client-computed values verbatim — it never recomputes (D2).
    const r = await this.prisma.progressSnapshot.create({
      data: {
        id,
        userId,
        weekStart: data.weekStart,
        avgWeightKg: data.avgWeightKg,
        totalVolumeKg: data.totalVolumeKg,
        avgCalories: data.avgCalories,
        workoutCount: data.workoutCount,
        isDeloadWeek: data.isDeloadWeek,
        ruleVersion: data.ruleVersion,
      },
    });
    return progressSnapshotRowToRecord(r);
  }

  async updateProgressSnapshot(
    id: string,
    data: ProgressSnapshotUpdateInput,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.progressSnapshot.update({
      where: { id },
      data: {
        weekStart: data.weekStart,
        avgWeightKg: data.avgWeightKg,
        totalVolumeKg: data.totalVolumeKg,
        avgCalories: data.avgCalories,
        workoutCount: data.workoutCount,
        isDeloadWeek: data.isDeloadWeek,
        ruleVersion: data.ruleVersion,
        version: newVersion,
      },
    });
  }

  async softDeleteProgressSnapshot(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.progressSnapshot.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async progressSnapshotsChangedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProgressSnapshotRecord[]> {
    const rows = await this.prisma.progressSnapshot.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(progressSnapshotRowToRecord);
  }
}
