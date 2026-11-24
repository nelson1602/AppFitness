import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

import { MailModule } from '../mail/mail.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';

import { AuthService } from './application/auth.service';
import { EmailVerificationService } from './application/email-verification.service';
import { PasswordRecoveryService } from './application/password-recovery.service';
import { CLOCK, SystemClock } from './infrastructure/clock.service';
import { PasswordService } from './infrastructure/password.service';
import { LoginThrottleService } from './application/login-throttle.service';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  TokenService,
} from './infrastructure/token.service';
import { noStore } from './presentation/no-store.middleware';
import { AuthController } from './presentation/auth.controller';
import { EmailVerifiedGuard } from './presentation/guards/email-verified.guard';
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
  // ADR-P046: an HS256 key shorter than the hash output (32 bytes) is weak.
  // Measured in bytes, so a multi-byte character cannot pad a short secret.
  if (Buffer.byteLength(secret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `JWT_ACCESS_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes`,
    );
  }
  return secret;
}

/** ADR-P046: the minimum JWT signing-secret length, in bytes. */
export const MIN_JWT_SECRET_BYTES = 32;

/**
 * Authentication module (Phase 6): Argon2 credentials, JWT access tokens,
 * single-use rotating refresh tokens with reuse detection, RBAC baseline.
 *
 * Registers the global guards: every route in the API requires a valid
 * Bearer token unless marked @Public() — fail closed by default.
 */
@Module({
  imports: [
    // Transactional mail for password recovery (ADR-P026 Vertical 1). The
    // module binds a real transport only when MAIL_PROVIDER is configured;
    // otherwise recovery reports unavailable and never pretends to send.
    MailModule,
    SubscriptionModule,
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
          // ADR-P046: HS256 only, fixed issuer and audience, both ways.
          signOptions: {
            expiresIn,
            algorithm: JWT_ALGORITHM,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
          },
          verifyOptions: {
            algorithms: [JWT_ALGORITHM],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordRecoveryService,
    // Email verification (ADR-P026 Vertical 2, V2-C). Issuance is best-effort
    // and can never alter the registration response.
    EmailVerificationService,
    // Time seam for the password-recovery response floor; specs swap it for a
    // scripted clock so the timing boundary is asserted, not measured.
    { provide: CLOCK, useClass: SystemClock },
    PasswordService,
    TokenService,
    LoginThrottleService,
    // Guard order matters: multiple APP_GUARD entries in one providers array
    // execute top-to-bottom. ThrottlerGuard is first so rate limiting runs
    // BEFORE the JWT/Roles guards and before any Argon2/DB work (ADR-P020).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Mandatory email verification (ADR-P041). After JWT so the caller is
    // known; before Roles so an unverified account learns nothing more.
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // The staff backoffice (ADR-P049) reuses these for its support actions and
  // its own sign-in, rather than duplicating them.
  exports: [
    TokenService,
    AuthService,
    EmailVerificationService,
    PasswordRecoveryService,
    LoginThrottleService,
    PasswordService,
    CLOCK,
  ],
})
export class AuthModule implements NestModule {
  // ADR-P046: no /auth response (tokens, account data, errors) may be cached
  // by the client, a proxy or a CDN. Middleware, so it also covers guard
  // rejections that never reach a handler.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes('auth');
  }
}
