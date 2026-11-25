import { foodKind } from './catalog-admin.service';

describe('foodKind (ADR-P049 amendment 1)', () => {
  it('tells staff, imported and built-in foods apart by catalogue key', () => {
    expect(foodKind('staff.6f1c1d1e-0000-4000-8000-000000000001')).toBe(
      'staff',
    );
    expect(foodKind('fdc.168201')).toBe('external');
    expect(foodKind('off.7501000111111')).toBe('external');
    expect(foodKind('food.rice.white.cooked')).toBe('bundled');
  });

  it('treats any unknown key as built-in, so it is never edited here', () => {
    expect(foodKind('something.else')).toBe('bundled');
    expect(foodKind('staffx.1')).toBe('bundled');
  });
});
