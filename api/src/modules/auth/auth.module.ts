import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from './application/auth.service';
import { PasswordService } from './infrastructure/password.service';
import { TokenService } from './infrastructure/token.service';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

const DEV_ONLY_FALLBACK_SECRET =
  'dev-only-jwt-secret-never-use-in-production-0001';

/**
 * Resolve the JWT access-token signing secret, failing closed (C-2).
 *
 * A configured secret is always used verbatim. When none is set, the
 * dev-only fallback is permitted ONLY for `development`/`test`; every other
 * `NODE_ENV` — `production`, `staging`, `preview`, an unknown value, or
 * unset — throws at boot rather than silently signing tokens with a
 * committed constant. Pure by design (primitives in, string out) so the
 * fail-closed behavior is directly unit-testable.
 */
export function resolveJwtSecret(
  secret: string | undefined,
  nodeEnv: string | undefined,
): string {
  const allowDevFallback = nodeEnv === 'development' || nodeEnv === 'test';
  if (!secret) {
    if (!allowDevFallback) {
      throw new Error(
        'JWT_ACCESS_SECRET is required (fail-closed outside development/test)',
      );
    }
    return DEV_ONLY_FALLBACK_SECRET;
  }
  return secret;
}

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
        const secret = resolveJwtSecret(
          config.get<string>('JWT_ACCESS_SECRET'),
          config.get<string>('NODE_ENV'),
        );
        const expiresIn = (config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as JwtSignOptions['expiresIn'];
        return {
          secret,
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
    // Guard order matters: multiple APP_GUARD entries in one providers array
    // execute top-to-bottom. ThrottlerGuard is first so rate limiting runs
    // BEFORE the JWT/Roles guards and before any Argon2/DB work (ADR-P020).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
