import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { MedicalModule } from './modules/medical/medical.module';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';
import { WorkoutModule } from './modules/workout/workout.module';

@Module({
  imports: [
    // Captures unhandled exceptions when Sentry is initialized
    // (src/instrument.ts); a no-op otherwise. Must be first.
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    // API rate limiting / brute-force protection (ADR-P020 C-1A). One
    // unnamed/default in-memory throttler (120 req / 60 s per handler+IP);
    // route-level @Throttle overrides define route-specific auth/sync ceilings
    // (sync intentionally raises the default 120 limit to 240). Default req.ip
    // tracker relies on `trust proxy = 1` (main.ts). No Redis / no env kill
    // switch. The global ThrottlerGuard is bound in AuthModule ahead of the
    // JWT/Roles guards so throttling runs before costly authentication.
    ThrottlerModule.forRoot([{ ttl: seconds(60), limit: 120 }]),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MedicalModule,
    SyncModule,
    NutritionModule,
    WorkoutModule,
    ProgressModule,
  ],
  providers: [
    // Preserves Nest's normal HTTP error responses while reporting
    // non-HttpException failures to Sentry.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule {}
