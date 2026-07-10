import { filterByCategory, filterByTags, getById, listAll, search } from './food-catalog.service';

describe('food catalog service', () => {
  it('listAll returns the full catalog', () => {
    expect(listAll()).toHaveLength(300);
  });

  it('getById returns a known item and undefined for an unknown id', () => {
    expect(getById('food.chicken_breast')?.name).toMatch(/Chicken breast/);
    expect(getById('food.does_not_exist')).toBeUndefined();
  });

  it('filterByCategory returns only items in that category', () => {
    const veg = filterByCategory('vegetable');
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.every((f) => f.category === 'vegetable')).toBe(true);
  });

  it('filterByTags all-mode requires every tag', () => {
    const result = filterByTags(['high_protein', 'low_carb']);
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((f) => f.tags.includes('high_protein') && f.tags.includes('low_carb')),
    ).toBe(true);
  });

  it('filterByTags any-mode requires at least one tag', () => {
    const result = filterByTags(['vegan', 'high_fiber'], 'any');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((f) => f.tags.includes('vegan') || f.tags.includes('high_fiber'))).toBe(
      true,
    );
  });

  it('filterByTags with no tags returns the full catalog', () => {
    expect(filterByTags([])).toHaveLength(300);
  });

  it('search matches by name case-insensitively; blank returns nothing', () => {
    expect(search('SALMON').length).toBeGreaterThan(0);
    expect(search('  ')).toEqual([]);
    expect(search('zzzznotafood')).toEqual([]);
  });
});
