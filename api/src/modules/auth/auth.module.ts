import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { PasswordService } from './infrastructure/password.service';
import { TokenService } from './infrastructure/token.service';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

const DEV_ONLY_FALLBACK_SECRET =
  'dev-only-jwt-secret-never-use-in-production-0001';

/**
 * Authentication module (Phase 6): Argon2 credentials, JWT access tokens,
 * single-use rotating refresh tokens with reuse detection, RBAC baseline.
 *
 * Registers the global guards: every route in the API requires a valid
 * Bearer token unless marked @Public() — fail closed by default.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret && config.get<string>('NODE_ENV') === 'production') {
          throw new Error('JWT_ACCESS_SECRET is required in production');
        }
        const expiresIn = (config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as JwtSignOptions['expiresIn'];
        return {
          secret: secret ?? DEV_ONLY_FALLBACK_SECRET,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
