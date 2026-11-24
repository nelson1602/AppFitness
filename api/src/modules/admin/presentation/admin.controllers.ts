import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { seconds, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Public } from '../../auth/presentation/decorators/public.decorator';
import { AppManagementService } from '../application/app-management.service';
import { MetricsService } from '../application/metrics.service';
import { StaffAuditService } from '../application/staff-audit.service';
import { StaffAuthService } from '../application/staff-auth.service';
import { StaffManagementService } from '../application/staff-management.service';
import { UserSupportService } from '../application/user-support.service';
import type { StaffContext } from '../domain/staff.types';
import {
  AcceptInviteDto,
  AuditQuery,
  ConfirmInviteDto,
  CreateRoleDto,
  CreateStaffDto,
  DeleteUserDto,
  GrantPromotionalDto,
  InviteTokenDto,
  StaffLoginDto,
  TotpCodeDto,
  UpdateRoleDto,
  UpdateAppConfigDto,
  UpdateStaffDto,
  UserExportQuery,
  UserSearchQuery,
} from './admin.dto';
import {
  clearSessionCookie,
  ClientIp,
  CurrentStaff,
  readSessionCookie,
  RequirePermission,
  RequireStaff,
  setSessionCookie,
  StaffPublic,
} from './staff-http';
import { StaffSessionGuard } from './staff-session.guard';

/*
 * Every backoffice controller is @Public() for the APP's JWT guard (staff do
 * not hold app tokens) and guarded by StaffSessionGuard instead. Routes live
 * under /admin/api; adminGate (503 when unconfigured, CSRF, no-store) runs
 * first for all of them.
 */

const me = (staff: StaffContext) => ({
  id: staff.id,
  email: staff.email,
  displayName: staff.displayName,
  role: staff.role,
  permissions: staff.permissions,
});

@Public()
@UseGuards(StaffSessionGuard)
@Controller('admin/api/auth')
export class AdminAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @StaffPublic()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: seconds(900) } })
  async login(
    @Body() body: StaffLoginDto,
    @ClientIp() ip: string | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, maxAgeMs } = await this.auth.login({ ...body, ip });
    setSessionCookie(response, token, maxAgeMs);
    return { stage: 'mfa' };
  }

  @StaffPublic()
  @Post('totp')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: seconds(900) } })
  async totp(
    @Body() body: TotpCodeDto,
    @ClientIp() ip: string | null,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, maxAgeMs } = await this.auth.verifyTotp({
      pendingToken: readSessionCookie(request),
      code: body.code,
      ip,
    });
    setSessionCookie(response, token, maxAgeMs);
    const staff = await this.auth.resolveSession(token, ip);
    return me(staff!);
  }

  @RequireStaff()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentStaff() staff: StaffContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(staff);
    clearSessionCookie(response);
  }

  @RequireStaff()
  @Get('me')
  me(@CurrentStaff() staff: StaffContext) {
    return me(staff);
  }
}

@Public()
@UseGuards(StaffSessionGuard)
@StaffPublic()
@Controller('admin/api/invites')
@Throttle({ default: { limit: 20, ttl: seconds(900) } })
export class AdminInvitesController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('inspect')
  @HttpCode(200)
  inspect(@Body() body: InviteTokenDto) {
    return this.auth.inspectInvite(body.token);
  }

  @Post('accept')
  @HttpCode(200)
  accept(@Body() body: AcceptInviteDto) {
    return this.auth.acceptInvite(body);
  }

  @Post('confirm')
  @HttpCode(204)
  async confirm(
    @Body() body: ConfirmInviteDto,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.auth.confirmInvite({ ...body, ip });
  }
}

@Public()
@UseGuards(StaffSessionGuard)
@Controller('admin/api')
export class AdminStaffController {
  constructor(private readonly staff: StaffManagementService) {}

  @RequirePermission('staff.manage')
  @Get('staff')
  list() {
    return this.staff.listStaff();
  }

  @RequirePermission('staff.manage')
  @Post('staff')
  create(@CurrentStaff() actor: StaffContext, @Body() body: CreateStaffDto) {
    return this.staff.createStaff(actor, body);
  }

  @RequirePermission('staff.manage')
  @Post('staff/:id/resend-invite')
  @HttpCode(204)
  async resend(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.staff.resendInvite(actor, id);
  }

  @RequirePermission('staff.manage')
  @Patch('staff/:id')
  update(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staff.updateStaff(actor, id, body);
  }

  @RequirePermission('staff.manage')
  @Post('staff/:id/disable')
  @HttpCode(204)
  async disable(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.staff.disableStaff(actor, id);
  }

  @RequirePermission('staff.manage')
  @Post('staff/:id/enable')
  @HttpCode(204)
  async enable(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.staff.enableStaff(actor, id);
  }

  @RequirePermission('roles.manage')
  @Get('permissions')
  permissions() {
    return this.staff.listPermissions();
  }

  @RequirePermission('roles.manage')
  @Get('roles')
  roles() {
    return this.staff.listRoles();
  }

  @RequirePermission('roles.manage')
  @Post('roles')
  createRole(@CurrentStaff() actor: StaffContext, @Body() body: CreateRoleDto) {
    return this.staff.createRole(actor, body);
  }

  @RequirePermission('roles.manage')
  @Patch('roles/:id')
  @HttpCode(204)
  async updateRole(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
  ): Promise<void> {
    await this.staff.updateRole(actor, id, body);
  }

  @RequirePermission('roles.manage')
  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.staff.deleteRole(actor, id);
  }
}

@Public()
@UseGuards(StaffSessionGuard)
@Controller('admin/api')
export class AdminUsersController {
  constructor(
    private readonly users: UserSupportService,
    private readonly metrics: MetricsService,
    private readonly audit: StaffAuditService,
  ) {}

  @RequirePermission('users.read')
  @Get('users')
  search(@Query() query: UserSearchQuery) {
    return this.users.search(query);
  }

  @RequirePermission('users.read')
  @Get('users/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.detail(id);
  }

  @RequirePermission('users.support')
  @Post('users/:id/resend-verification')
  @HttpCode(202)
  async resendVerification(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.resendVerification(actor, id);
  }

  @RequirePermission('users.support')
  @Post('users/:id/send-password-reset')
  @HttpCode(202)
  async sendPasswordReset(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.sendPasswordReset(actor, id);
  }

  @RequirePermission('users.support')
  @Post('users/:id/clear-throttle')
  @HttpCode(204)
  async clearThrottle(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.clearThrottle(actor, id);
  }

  @RequirePermission('users.support')
  @Post('users/:id/logout-everywhere')
  @HttpCode(204)
  async logoutEverywhere(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.logoutEverywhere(actor, id);
  }

  @RequirePermission('users.suspend')
  @Post('users/:id/suspend')
  @HttpCode(204)
  async suspend(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.suspend(actor, id);
  }

  @RequirePermission('users.suspend')
  @Post('users/:id/reactivate')
  @HttpCode(204)
  async reactivate(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.users.reactivate(actor, id);
  }

  @RequirePermission('users.delete')
  @Post('users/:id/delete')
  @HttpCode(204)
  async remove(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteUserDto,
  ): Promise<void> {
    await this.users.deleteAccount(actor, id, body.confirmEmail);
  }

  @RequirePermission('metrics.read')
  @Get('metrics/dashboard')
  dashboard() {
    return this.metrics.dashboard();
  }

  @RequirePermission('audit.read')
  @Get('audit')
  auditLog(@Query() query: AuditQuery) {
    return this.audit.list(query);
  }
}

/** ADR-P049 amendment 1: app config, CSV export, promotional Pro. */
@Public()
@UseGuards(StaffSessionGuard)
@Controller('admin/api')
export class AdminAppController {
  constructor(private readonly app: AppManagementService) {}

  @RequirePermission('config.manage')
  @Get('config')
  config() {
    return this.app.getConfig();
  }

  @RequirePermission('config.manage')
  @Put('config')
  updateConfig(
    @CurrentStaff() actor: StaffContext,
    @Body() body: UpdateAppConfigDto,
  ) {
    return this.app.updateConfig(actor, {
      maintenanceEnabled: body.maintenanceEnabled,
      maintenanceTone: body.maintenanceTone,
      maintenanceMessageEs: body.maintenanceMessageEs ?? null,
      maintenanceMessageEn: body.maintenanceMessageEn ?? null,
      minAndroidVersionCode: body.minAndroidVersionCode ?? null,
    });
  }

  /** The user list as CSV (same filter as the list; never health data). */
  @RequirePermission('users.read')
  @Get('export/users.csv')
  async exportUsers(
    @CurrentStaff() actor: StaffContext,
    @Query() query: UserExportQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { csv } = await this.app.exportUsers(actor, query);
    const stamp = new Date().toISOString().slice(0, 10);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="usuarios-${stamp}.csv"`,
    );
    return csv;
  }

  @RequirePermission('subscriptions.read')
  @Get('users/:id/subscription')
  subscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.app.subscription(id);
  }

  @RequirePermission('subscriptions.grant')
  @Post('users/:id/subscription/promotional')
  @HttpCode(200)
  grant(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GrantPromotionalDto,
  ) {
    return this.app.changePromotional(actor, id, { grant: body.duration });
  }

  @RequirePermission('subscriptions.grant')
  @Post('users/:id/subscription/revoke-promotional')
  @HttpCode(200)
  revoke(
    @CurrentStaff() actor: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.app.changePromotional(actor, id, { revoke: true });
  }
}
