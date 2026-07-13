import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { MedicalModule } from './modules/medical/medical.module';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Captures unhandled exceptions when Sentry is initialized
    // (src/instrument.ts); a no-op otherwise. Must be first.
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MedicalModule,
    SyncModule,
    NutritionModule,
  ],
  providers: [
    // Preserves Nest's normal HTTP error responses while reporting
    // non-HttpException failures to Sentry.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule {}
