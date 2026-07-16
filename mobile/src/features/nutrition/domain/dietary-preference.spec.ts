import type { DietaryPreferenceRow } from '../../../shared/infrastructure/database/types';

import { rowToDietaryPreference } from './dietary-preference';

function row(overrides: Partial<DietaryPreferenceRow> = {}): DietaryPreferenceRow {
  return {
    id: 'dp-1',
    user_id: 'user-1',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    version: 1,
    deleted_at: null,
    deleted_by: null,
    sync_status: 'pending',
    exclusion_type: 'avoid_tag',
    avoid_tag: 'nut_allergy',
    catalog_key: null,
    kind: 'allergy',
    note_enc: null,
    enc_key_id: null,
    ...overrides,
  };
}

describe('rowToDietaryPreference', () => {
  it('maps an avoid-tag allergy exclusion', () => {
    const dp = rowToDietaryPreference(row());
    expect(dp).toMatchObject({
      id: 'dp-1',
      userId: 'user-1',
      exclusionType: 'avoid_tag',
      avoidTag: 'nut_allergy',
      catalogKey: null,
      kind: 'allergy',
      hasNote: false,
      version: 1,
      syncStatus: 'pending',
    });
  });

  it('maps an explicit catalog-key preference exclusion', () => {
    const dp = rowToDietaryPreference(
      row({
        exclusion_type: 'catalog_key',
        avoid_tag: null,
        catalog_key: 'food.pomegranate',
        kind: 'preference',
      }),
    );
    expect(dp.exclusionType).toBe('catalog_key');
    expect(dp.catalogKey).toBe('food.pomegranate');
    expect(dp.avoidTag).toBeNull();
    expect(dp.kind).toBe('preference');
  });

  it('reports note presence without carrying the decrypted text', () => {
    const dp = rowToDietaryPreference(row({ note_enc: new Uint8Array([1, 2, 3]) }));
    expect(dp.hasNote).toBe(true);
    // The domain shape exposes no plaintext note field at all.
    expect(dp as unknown as Record<string, unknown>).not.toHaveProperty('note');
  });
});
