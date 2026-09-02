import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { resolveMailLocale } from '../../mail/domain/mail.types';
import { AuthService, type AuthResult } from '../application/auth.service';
import { PasswordRecoveryService } from '../application/password-recovery.service';
import type {
  AuthenticatedUser,
  SafeUser,
  TokenPair,
} from '../domain/auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecovery: PasswordRecoveryService,
  ) {}

  // Anti-account-farming cap: 10 registrations / 60 min per IP (ADR-P020).
  @Throttle({ default: { limit: 10, ttl: seconds(3600) } })
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and receive a token pair' })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  // Brute-force cap: 20 login attempts / 15 min per IP (ADR-P020).
  @Throttle({ default: { limit: 20, ttl: seconds(900) } })
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate and receive a token pair' })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  // Abuse ceiling for token rotation: 120 / 15 min per IP (ADR-P020) — high
  // because refresh tokens are high-entropy, single-use, and reuse revokes
  // the session family.
  @Throttle({ default: { limit: 120, ttl: seconds(900) } })
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Rotate a refresh token (single-use; reuse revokes the session family)',
  })
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.me(user.id);
  }

  @Delete('account')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Permanently delete the authenticated account and all user-owned data (irreversible)',
  })
  async deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.deleteAccount(user.id);
  }

  /**
   * Request a password-reset email (ADR-P026 Vertical 1).
   *
   * ALWAYS answers `202` with the same body — for a real account, an unknown
   * address, a suspended account, and an account that hit its per-account
   * ceiling alike. The only other outcome is a single generic `503` when mail
   * is globally disabled, which is decided before any account lookup.
   *
   * Per-IP cap: 5 requests / 60 min (ADR-P020 posture). The complementary
   * per-account cap lives in the service, because IP-only throttling still
   * permits mailbombing one address from many sources (ADR-P026 Decision 8).
   */
  @Throttle({ default: { limit: 5, ttl: seconds(3600) } })
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Request a password-reset email (always 202 — never reveals whether the account exists)',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ status: 'accepted' }> {
    await this.passwordRecovery.requestReset({
      email: dto.email,
      locale: resolveMailLocale(dto.locale),
    });
    // A fixed literal, built after the call and independent of its outcome.
    return { status: 'accepted' };
  }

  /**
   * Redeem a reset token and set a new password.
   *
   * Single-use and atomic: unknown, expired, superseded and already-used
   * tokens all produce the same generic 400. Success revokes every refresh
   * token for the account, so all other sessions end.
   */
  @Throttle({ default: { limit: 10, ttl: seconds(900) } })
  @Public()
  @Post('reset-password')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Set a new password from a reset token (single-use; revokes every session)',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordRecovery.resetPassword({
      token: dto.token,
      password: dto.password,
    });
  }
}
