import type { AppConfig } from '@prisma/client';

import { toPublic } from './app-config.service';

const row = (patch: Partial<AppConfig>): AppConfig => ({
  id: 'global',
  maintenanceEnabled: false,
  maintenanceTone: 'warning',
  maintenanceMessageEs: null,
  maintenanceMessageEn: null,
  minAndroidVersionCode: null,
  updatedAt: new Date(),
  updatedByStaffId: null,
  ...patch,
});

describe('public app config (ADR-P049 amendment 1)', () => {
  it('shows no banner and no minimum by default', () => {
    expect(toPublic(row({}))).toEqual({
      maintenance: null,
      minAndroidVersionCode: null,
    });
  });

  it('shows the banner only when enabled with both texts', () => {
    expect(
      toPublic(
        row({
          maintenanceEnabled: true,
          maintenanceTone: 'info',
          maintenanceMessageEs: 'Mantenimiento esta noche',
          maintenanceMessageEn: 'Maintenance tonight',
        }),
      ).maintenance,
    ).toEqual({
      tone: 'info',
      message: { es: 'Mantenimiento esta noche', en: 'Maintenance tonight' },
    });
    expect(
      toPublic(row({ maintenanceEnabled: true, maintenanceMessageEs: 'x' }))
        .maintenance,
    ).toBeNull();
  });

  it('never exposes who changed it or when', () => {
    expect(
      Object.keys(toPublic(row({ updatedByStaffId: 'staff-id' }))).sort(),
    ).toEqual(['maintenance', 'minAndroidVersionCode']);
  });
});
