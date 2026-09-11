import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { SyncConflictService } from '../application/sync-conflict.service';
import {
  SyncService,
  type PullResult,
  type PushResult,
} from '../application/sync.service';
import type {
  ListConflictsResult,
  ResolveConflictResponse,
} from '../domain/sync-conflict.types';
import { ListConflictsQueryDto } from './dto/list-conflicts-query.dto';
import { PullQueryDto } from './dto/pull-query.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import { ResolveConflictDto } from './dto/resolve-conflict.dto';

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
  constructor(
    private readonly syncService: SyncService,
    private readonly conflicts: SyncConflictService,
  ) {}

  // Reconnect-burst ceiling: 240 / 60 s per IP (ADR-P020) — a device draining
  // its offline queue (≤100 ops/req) fits with headroom for a few devices/IP.
  @Throttle({ default: { limit: 240, ttl: seconds(60) } })
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

  // Reconnect-burst ceiling: 240 / 60 s per IP (ADR-P020) — cursor-paged
  // pulls (limit 100) across entity types stay within one active device.
  @Throttle({ default: { limit: 240, ttl: seconds(60) } })
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

  @Throttle({ default: { limit: 240, ttl: seconds(60) } })
  @Get('conflicts')
  @ApiOperation({
    summary: 'List pending conflicts and reconcile locally-known statuses',
  })
  listConflicts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConflictsQueryDto,
  ): Promise<ListConflictsResult> {
    return this.conflicts.list(user.id, query);
  }

  @Throttle({ default: { limit: 240, ttl: seconds(60) } })
  @Post('conflicts/:id/resolve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resolve one owned sync conflict with optimistic concurrency',
  })
  resolveConflict(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveConflictDto,
  ): Promise<ResolveConflictResponse> {
    return this.conflicts.resolve(user.id, id, dto);
  }
}
