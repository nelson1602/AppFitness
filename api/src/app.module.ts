import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { MedicalModule } from './modules/medical/medical.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MedicalModule,
    SyncModule,
  ],
})
export class AppModule {}
