import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
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
import { FieldCipherService } from './field-cipher.service';
import { evaluationToDomain, restrictionToDomain } from './medical.mapper';

const asDate = (s: string): Date => new Date(`${s}T00:00:00Z`);

@Injectable()
export class PrismaEvaluationRepository extends EvaluationRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipherService,
  ) {
    super();
  }

  async findOwned(
    userId: string,
    id: string,
  ): Promise<EvaluationRecord | null> {
    const row = await this.prisma.medicalEvaluation.findFirst({
      where: { id, userId },
    });
    return row ? evaluationToDomain(row, this.cipher) : null;
  }

  async listByUser(userId: string): Promise<EvaluationRecord[]> {
    const rows = await this.prisma.medicalEvaluation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { evaluationDate: 'desc' },
    });
    return rows.map((row) => evaluationToDomain(row, this.cipher));
  }

  async create(
    userId: string,
    attributes: Partial<EvaluationAttributes>,
    id?: string,
  ): Promise<EvaluationRecord> {
    const row = await this.prisma.medicalEvaluation.create({
      data: {
        id: id ?? randomUUID(), // client-generatable PK; REST mints one
        userId, // authenticated owner only — never from payload
        evaluationDate: asDate(attributes.evaluationDate ?? ''),
        weightKg: attributes.weightKg ?? null,
        bodyFatPct: attributes.bodyFatPct ?? null,
        muscleMassKg: attributes.muscleMassKg ?? null,
        bloodPressureSystolic: attributes.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: attributes.bloodPressureDiastolic ?? null,
        restingHeartRate: attributes.restingHeartRate ?? null,
        sleepQuality: attributes.sleepQuality ?? null,
        stressLevel: attributes.stressLevel ?? null,
        activityLevel: attributes.activityLevel ?? null,
        doctorNotesEnc: this.encryptOrNull(attributes.doctorNotes),
        medicalConditionsEnc: this.encryptOrNull(attributes.medicalConditions),
        medicationsEnc: this.encryptOrNull(attributes.medications),
        encKeyId: this.cipher.keyId,
      },
    });
    return evaluationToDomain(row, this.cipher);
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.medicalEvaluation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<EvaluationRecord[]> {
    const rows = await this.prisma.medicalEvaluation.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map((row) => evaluationToDomain(row, this.cipher));
  }

  private encryptOrNull(
    plain: string | null | undefined,
  ): Uint8Array<ArrayBuffer> | null {
    return plain == null || plain === '' ? null : this.cipher.encrypt(plain);
  }
}

@Injectable()
export class PrismaRestrictionRepository extends RestrictionRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipherService,
  ) {
    super();
  }

  async findOwned(
    userId: string,
    id: string,
  ): Promise<RestrictionRecord | null> {
    const row = await this.prisma.medicalRestriction.findFirst({
      where: { id, userId },
    });
    return row ? restrictionToDomain(row, this.cipher) : null;
  }

  async listActive(userId: string): Promise<RestrictionRecord[]> {
    const rows = await this.prisma.medicalRestriction.findMany({
      where: { userId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => restrictionToDomain(row, this.cipher));
  }

  async create(
    userId: string,
    attributes: Partial<RestrictionAttributes>,
    id?: string,
  ): Promise<RestrictionRecord> {
    const row = await this.prisma.medicalRestriction.create({
      data: {
        id: id ?? randomUUID(),
        userId,
        type: attributes.type ?? 'INJURY',
        bodyArea: attributes.bodyArea ?? null,
        severity: attributes.severity ?? null,
        notesEnc:
          attributes.notes == null || attributes.notes === ''
            ? null
            : this.cipher.encrypt(attributes.notes),
        encKeyId: this.cipher.keyId,
        isActive: attributes.isActive ?? true,
        effectiveFrom: attributes.effectiveFrom
          ? asDate(attributes.effectiveFrom)
          : null,
        effectiveUntil: attributes.effectiveUntil
          ? asDate(attributes.effectiveUntil)
          : null,
      },
    });
    return restrictionToDomain(row, this.cipher);
  }

  async update(
    id: string,
    attributes: Partial<RestrictionAttributes>,
    newVersion: number,
  ): Promise<RestrictionRecord> {
    const data: Prisma.MedicalRestrictionUpdateInput = { version: newVersion };
    if (attributes.type !== undefined) data.type = attributes.type;
    if (attributes.bodyArea !== undefined) data.bodyArea = attributes.bodyArea;
    if (attributes.severity !== undefined) data.severity = attributes.severity;
    if (attributes.notes !== undefined) {
      data.notesEnc =
        attributes.notes === null || attributes.notes === ''
          ? null
          : this.cipher.encrypt(attributes.notes);
      data.encKeyId = this.cipher.keyId;
    }
    if (attributes.isActive !== undefined) data.isActive = attributes.isActive;
    if (attributes.effectiveFrom !== undefined) {
      data.effectiveFrom = attributes.effectiveFrom
        ? asDate(attributes.effectiveFrom)
        : null;
    }
    if (attributes.effectiveUntil !== undefined) {
      data.effectiveUntil = attributes.effectiveUntil
        ? asDate(attributes.effectiveUntil)
        : null;
    }
    const row = await this.prisma.medicalRestriction.update({
      where: { id },
      data,
    });
    return restrictionToDomain(row, this.cipher);
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.medicalRestriction.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<RestrictionRecord[]> {
    const rows = await this.prisma.medicalRestriction.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map((row) => restrictionToDomain(row, this.cipher));
  }
}
