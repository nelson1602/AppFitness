import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import {
  ADMIN_CONFIG,
  type AdminConfig,
  resolveAdminConfig,
} from './admin.config';
import { MetricsService } from './application/metrics.service';
import { StaffAuditService } from './application/staff-audit.service';
import { StaffAuthService } from './application/staff-auth.service';
import { StaffManagementService } from './application/staff-management.service';
import { UserSupportService } from './application/user-support.service';
import { StaffSecretsService } from './infrastructure/staff-secrets.service';
import { adminGate } from './presentation/admin-gate.middleware';
import {
  AdminAuthController,
  AdminInvitesController,
  AdminStaffController,
  AdminUsersController,
} from './presentation/admin.controllers';
import { StaffSessionGuard } from './presentation/staff-session.guard';

/**
 * Staff backoffice (ADR-P049): separate staff identity, TOTP two-factor
 * sign-in, permission-checked routes under /admin/api, an append-only staff
 * audit trail, and support actions that reuse the app's own flows.
 */
@Module({
  imports: [AuthModule, MailModule],
  controllers: [
    AdminAuthController,
    AdminInvitesController,
    AdminStaffController,
    AdminUsersController,
  ],
  providers: [
    {
      provide: ADMIN_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AdminConfig =>
        resolveAdminConfig({
          ADMIN_SESSION_SECRET: config.get<string>('ADMIN_SESSION_SECRET'),
          ADMIN_TOTP_ENC_KEY: config.get<string>('ADMIN_TOTP_ENC_KEY'),
          ADMIN_PUBLIC_URL: config.get<string>('ADMIN_PUBLIC_URL'),
          ADMIN_STATIC_DIR: config.get<string>('ADMIN_STATIC_DIR'),
        }),
    },
    StaffSecretsService,
    StaffAuditService,
    StaffAuthService,
    StaffManagementService,
    UserSupportService,
    MetricsService,
    StaffSessionGuard,
  ],
  exports: [ADMIN_CONFIG, StaffManagementService],
})
export class AdminModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    const resolved = resolveAdminConfig({
      ADMIN_SESSION_SECRET: this.config.get<string>('ADMIN_SESSION_SECRET'),
      ADMIN_TOTP_ENC_KEY: this.config.get<string>('ADMIN_TOTP_ENC_KEY'),
      ADMIN_PUBLIC_URL: this.config.get<string>('ADMIN_PUBLIC_URL'),
      ADMIN_STATIC_DIR: this.config.get<string>('ADMIN_STATIC_DIR'),
    });
    consumer
      .apply(adminGate(resolved))
      .forRoutes({ path: 'admin/api/*path', method: RequestMethod.ALL });
  }
}
