import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import { ProfileAttributes, ProfileRecord } from '../domain/profile.types';
import { toDomain } from './profile.mapper';

function toPrismaData(
  attributes: Partial<ProfileAttributes>,
): Prisma.UserProfileUpdateInput {
  const data: Prisma.UserProfileUpdateInput = {};
  if (attributes.birthDate !== undefined) {
    data.birthDate = attributes.birthDate
      ? new Date(`${attributes.birthDate}T00:00:00Z`)
      : null;
  }
  if (attributes.gender !== undefined) data.gender = attributes.gender;
  if (attributes.heightCm !== undefined) data.heightCm = attributes.heightCm;
  if (attributes.fitnessLevel !== undefined)
    data.fitnessLevel = attributes.fitnessLevel;
  if (attributes.yearsTraining !== undefined)
    data.yearsTraining = attributes.yearsTraining;
  if (attributes.activityLevel !== undefined)
    data.activityLevel = attributes.activityLevel;
  if (attributes.occupation !== undefined)
    data.occupation = attributes.occupation;
  if (attributes.sleepHoursBaseline !== undefined)
    data.sleepHoursBaseline = attributes.sleepHoursBaseline;
  if (attributes.stressLevelBaseline !== undefined)
    data.stressLevelBaseline = attributes.stressLevelBaseline;
  if (attributes.equipment !== undefined) data.equipment = attributes.equipment;
  if (attributes.trainingDaysPerWeek !== undefined)
    data.trainingDaysPerWeek = attributes.trainingDaysPerWeek;
  if (attributes.sessionDurationMins !== undefined)
    data.sessionDurationMins = attributes.sessionDurationMins;
  if (attributes.targetCalories !== undefined)
    data.targetCalories = attributes.targetCalories;
  if (attributes.targetProteinG !== undefined)
    data.targetProteinG = attributes.targetProteinG;
  if (attributes.targetCarbsG !== undefined)
    data.targetCarbsG = attributes.targetCarbsG;
  if (attributes.targetFatG !== undefined)
    data.targetFatG = attributes.targetFatG;
  return data;
}

@Injectable()
export class PrismaProfileRepository extends ProfileRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const row = await this.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    return row ? toDomain(row) : null;
  }

  async findOwned(userId: string, id: string): Promise<ProfileRecord | null> {
    const row = await this.prisma.userProfile.findFirst({
      where: { id, userId },
    });
    return row ? toDomain(row) : null;
  }

  async create(
    userId: string,
    attributes: Partial<ProfileAttributes>,
    id?: string,
  ): Promise<ProfileRecord> {
    const row = await this.prisma.userProfile.create({
      data: {
        ...(toPrismaData(attributes) as Prisma.UserProfileUncheckedCreateInput),
        ...(id ? { id } : {}),
        userId, // last: the authenticated owner always wins over any payload
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    attributes: Partial<ProfileAttributes>,
    newVersion: number,
  ): Promise<ProfileRecord> {
    const row = await this.prisma.userProfile.update({
      where: { id },
      data: { ...toPrismaData(attributes), version: newVersion },
    });
    return toDomain(row);
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<ProfileRecord[]> {
    const rows = await this.prisma.userProfile.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(toDomain);
  }
}
