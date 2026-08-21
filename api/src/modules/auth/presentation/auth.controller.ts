import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService, type AuthResult } from '../application/auth.service';
import type {
  AuthenticatedUser,
  SafeUser,
  TokenPair,
} from '../domain/auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
