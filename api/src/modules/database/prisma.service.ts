import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEV_ONLY_PLACEHOLDER_URL =
  'postgresql://placeholder:placeholder@localhost:5433/appfitness_dev';

/**
 * Resolve the Postgres connection string, failing closed (C-2).
 *
 * A configured `DATABASE_URL` is always used verbatim. When none is set, the
 * dev-only placeholder (which keeps lazy-boot working for local dev and the
 * e2e suite) is permitted ONLY for `development`/`test`; every other
 * `NODE_ENV` — `production`, `staging`, `preview`, an unknown value, or
 * unset — throws at boot rather than silently connecting to a placeholder
 * database. Pure by design so the fail-closed behavior is unit-testable.
 */
export function resolveDatabaseUrl(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
): string {
  const allowDevFallback = nodeEnv === 'development' || nodeEnv === 'test';
  if (!databaseUrl) {
    if (!allowDevFallback) {
      throw new Error(
        'DATABASE_URL is required (fail-closed outside development/test)',
      );
    }
    return DEV_ONLY_PLACEHOLDER_URL;
  }
  return databaseUrl;
}

/**
 * Prisma 7 client with the pg driver adapter (connection URL never lives
 * in schema.prisma). Connects lazily on first query so the app — and the
 * e2e test suite — boots without a live database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString = resolveDatabaseUrl(
      config.get<string>('DATABASE_URL'),
      config.get<string>('NODE_ENV'),
    );
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
