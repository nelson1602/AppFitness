import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 client with the pg driver adapter (connection URL never lives
 * in schema.prisma). Connects lazily on first query so the app — and the
 * e2e test suite — boots without a live database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>('DATABASE_URL') ??
      'postgresql://placeholder:placeholder@localhost:5433/appfitness_dev';
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
