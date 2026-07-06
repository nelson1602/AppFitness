import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import {
  SyncService,
  type PullResult,
  type PushResult,
} from '../application/sync.service';
import { PullQueryDto } from './dto/pull-query.dto';
import { PushSyncDto } from './dto/push-sync.dto';

const DEFAULT_PULL_LIMIT = 100;

/**
 * Sync endpoints are protected by the global JWT guard (Phase 6) — the
 * authenticated user is the only identity source. The temporary
 * x-user-id header from Phase 5 is gone.
 */
@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @ApiOperation({
    summary: 'Push queued client operations (idempotent by opId)',
  })
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PushSyncDto,
  ): Promise<PushResult> {
    return this.syncService.push(user.id, dto.deviceId ?? null, dto.operations);
  }

  @Get('pull')
  @ApiOperation({
    summary: 'Pull changes since a sync_seq cursor (incremental)',
  })
  pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PullQueryDto,
  ): Promise<PullResult> {
    return this.syncService.pull(
      user.id,
      query.since,
      query.limit ?? DEFAULT_PULL_LIMIT,
      query.entityTypes,
    );
  }
}
