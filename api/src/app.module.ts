import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';

import { buildThrottlerOptions } from './config/throttler.config';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
// No MedicalModule import — see the note in `imports` below.
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
    // unnamed/default in-memory throttler (120 req / 60 s per handler+tracker);
    // route-level @Throttle overrides define route-specific auth/sync ceilings
    // (sync intentionally raises the default 120 limit to 240). The per-client
    // tracker (config/throttler.config.ts) keys on Railway's sanitized first
    // X-Forwarded-For entry on the platform, and on req.ip elsewhere — the
    // 2026-08-21 Development live test disproved the earlier `trust proxy = 1`
    // req.ip approach. No Redis / no env kill switch. The global ThrottlerGuard
    // is bound in AuthModule ahead of the JWT/Roles guards so throttling runs
    // before costly authentication.
    ThrottlerModule.forRoot(buildThrottlerOptions()),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    // `MedicalModule` is intentionally excluded: importing it would mount
    // `MedicalController` and register the medical sync handlers, both of which
    // public V1 must not expose (ADR-P017 Decision 4). Re-adding it is
    // prohibited without the ADR-P017 Decision 9 gate — see the ADR for the
    // rationale, what stays preserved, and the reactivation requirements.
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
