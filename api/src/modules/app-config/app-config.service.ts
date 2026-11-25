import { Injectable } from '@nestjs/common';
import type { AppConfig } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

export type MaintenanceTone = 'info' | 'warning';

/** What the app reads (GET /app-config). Public: no account data. */
export interface PublicAppConfig {
  maintenance: {
    tone: MaintenanceTone;
    message: { es: string; en: string };
  } | null;
  minAndroidVersionCode: number | null;
}

export interface AppConfigInput {
  maintenanceEnabled: boolean;
  maintenanceTone: MaintenanceTone;
  maintenanceMessageEs: string | null;
  maintenanceMessageEn: string | null;
  minAndroidVersionCode: number | null;
}

/** The fields staff see and edit, and that the audit trail records. */
export function editableFields(row: AppConfig): AppConfigInput {
  return {
    maintenanceEnabled: row.maintenanceEnabled,
    maintenanceTone: row.maintenanceTone === 'info' ? 'info' : 'warning',
    maintenanceMessageEs: row.maintenanceMessageEs,
    maintenanceMessageEn: row.maintenanceMessageEn,
    minAndroidVersionCode: row.minAndroidVersionCode,
  };
}

export function toPublic(row: AppConfig): PublicAppConfig {
  const { maintenanceMessageEs: es, maintenanceMessageEn: en } = row;
  return {
    maintenance:
      row.maintenanceEnabled && es && en
        ? {
            tone: row.maintenanceTone === 'info' ? 'info' : 'warning',
            message: { es, en },
          }
        : null,
    minAndroidVersionCode: row.minAndroidVersionCode,
  };
}

/**
 * App config (ADR-P049 amendment 1): one row, seeded by its migration.
 * The backoffice writes it; the app reads it publicly.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  current(): Promise<AppConfig> {
    // The migration inserts the row; upsert keeps a fresh test database working.
    return this.prisma.appConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
    });
  }

  async publicView(): Promise<PublicAppConfig> {
    return toPublic(await this.current());
  }
}
