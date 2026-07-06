import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { GoalRepositoryPort } from '../domain/goal.repository';
import { GoalAttributes, GoalRecord } from '../domain/goal.types';
import { goalToDomain } from './goal.mapper';

function toPrismaData(
  attributes: Partial<GoalAttributes>,
): Prisma.GoalUpdateInput {
  const data: Prisma.GoalUpdateInput = {};
  if (attributes.goalType !== undefined) data.goalType = attributes.goalType;
  if (attributes.targetWeightKg !== undefined)
    data.targetWeightKg = attributes.targetWeightKg;
  if (attributes.targetDate !== undefined) {
    data.targetDate = attributes.targetDate
      ? new Date(`${attributes.targetDate}T00:00:00Z`)
      : null;
  }
  if (attributes.isActive !== undefined) data.isActive = attributes.isActive;
  if (attributes.startedAt !== undefined) data.startedAt = attributes.startedAt;
  if (attributes.endedAt !== undefined) data.endedAt = attributes.endedAt;
  return data;
}

@Injectable()
export class PrismaGoalRepository extends GoalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findOwned(userId: string, id: string): Promise<GoalRecord | null> {
    const row = await this.prisma.goal.findFirst({ where: { id, userId } });
    return row ? goalToDomain(row) : null;
  }

  async create(
    userId: string,
    attributes: Partial<GoalAttributes>,
    id: string,
  ): Promise<GoalRecord> {
    const row = await this.prisma.goal.create({
      data: {
        ...(toPrismaData(attributes) as Prisma.GoalUncheckedCreateInput),
        id,
        userId, // last: the authenticated owner always wins over any payload
      },
    });
    return goalToDomain(row);
  }

  async update(
    id: string,
    attributes: Partial<GoalAttributes>,
    newVersion: number,
  ): Promise<GoalRecord> {
    const row = await this.prisma.goal.update({
      where: { id },
      data: { ...toPrismaData(attributes), version: newVersion },
    });
    return goalToDomain(row);
  }

  async softDelete(
    id: string,
    deletedBy: string,
    newVersion: number,
  ): Promise<void> {
    await this.prisma.goal.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, version: newVersion },
    });
  }

  async changedSince(
    userId: string,
    sinceSeq: number,
    limit: number,
  ): Promise<GoalRecord[]> {
    const rows = await this.prisma.goal.findMany({
      where: { userId, syncSeq: { gt: BigInt(sinceSeq) } },
      orderBy: { syncSeq: 'asc' },
      take: limit,
    });
    return rows.map(goalToDomain);
  }
}
