import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { ProfileRepositoryPort } from '../domain/profile.repository';
import {
  PROFILE_DEFAULTS,
  ProfileAttributes,
  ProfileRecord,
} from '../domain/profile.types';

/**
 * Profile use cases for the REST surface (server-rendered/admin/web
 * clients). Mobile writes flow through sync, not these endpoints —
 * both paths bump `version`, so cross-path edits conflict correctly.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepositoryPort,
    private readonly audit: AuditService,
  ) {}

  async getMyProfile(userId: string): Promise<ProfileRecord> {
    const record = await this.profiles.findByUserId(userId);
    if (!record) throw new NotFoundException('Profile not found');
    return record;
  }

  async upsertMyProfile(
    userId: string,
    attributes: Partial<ProfileAttributes>,
  ): Promise<ProfileRecord> {
    const existing = await this.profiles.findByUserId(userId);

    const record = existing
      ? await this.profiles.update(
          existing.id,
          attributes,
          existing.version + 1,
        )
      : await this.profiles.create(userId, {
          ...PROFILE_DEFAULTS,
          ...attributes,
        });

    await this.audit.record({
      action: AuditAction.PROFILE_UPDATE,
      userId,
      entityType: 'user_profiles',
      entityId: record.id,
      metadata: { via: 'rest', operation: existing ? 'UPDATE' : 'CREATE' },
    });
    return record;
  }
}
