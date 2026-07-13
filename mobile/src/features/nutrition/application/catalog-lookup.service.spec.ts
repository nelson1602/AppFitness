import {
  getCanonicalById,
  getCanonicalByCatalogKey,
  listCanonicalFoods,
} from './catalog-lookup.service';

/**
 * The lookup bridges the catalog key/slug used by the UI to the persisted
 * UUIDv5 identity used for storage/sync (ADR-P012 Slice 4A).
 */
describe('catalog lookup service', () => {
  it('resolves a slug to its committed UUIDv5 id and back', () => {
    const bySlug = getCanonicalByCatalogKey('food.chicken_breast');
    expect(bySlug?.id).toBe('16cb6cd9-debe-55fd-b39e-aac043b8705e');
    expect(getCanonicalById(bySlug!.id)?.catalogKey).toBe('food.chicken_breast');
  });

  it('returns undefined for unknown identities', () => {
    expect(getCanonicalByCatalogKey('food.nope')).toBeUndefined();
    expect(getCanonicalById('not-a-real-id')).toBeUndefined();
  });

  it('exposes the full committed catalog', () => {
    expect(listCanonicalFoods().length).toBe(300);
  });
});
