import { formatKcalQuantity, formatNumber } from '@/shared/localization';
import { en as EN } from '@/shared/localization/resources/en';
import { es as ES } from '@/shared/localization/resources/es';

import { CARRY_OVER_RULE_VERSION, type CarryOver } from '../domain/carry-over';
import { carryOverText } from './carry-over-copy';

// The device (Hermes) reads "2.900"; Node's `es` locale does not group four
// digits. Expectations use the app's own formatters (units take a NBSP).
const n = (value: number) => formatNumber(value, 'es');
const k = (value: number, language: 'es' | 'en' = 'es') => formatKcalQuantity(value, language);

const carry = (overrides: Partial<CarryOver>): CarryOver => ({
  ruleVersion: CARRY_OVER_RULE_VERSION,
  adjustment: 0,
  yesterday: null,
  remaining: 0,
  ...overrides,
});

describe('carry-over sentence (ADR-P040 Addendum v11-B)', () => {
  const es = (key: string) => (ES as Record<string, string>)[key] ?? key;
  const en = (key: string) => (EN as Record<string, string>)[key] ?? key;

  it("names yesterday's intake and today's change, in Spanish and English", () => {
    const over = carry({
      adjustment: -189,
      yesterday: { date: '2026-11-12', consumed: 2900, target: 2711 },
    });
    expect(carryOverText(over, es, 'es')).toBe(
      `Ayer llegaste a ${n(2900)} de ${k(2711)}; hoy el iCoach reparte ${k(189)} menos entre tus comidas.`,
    );
    expect(carryOverText(over, en, 'en')).toBe(
      `Yesterday you reached 2,900 of ${k(2711, 'en')}; today the iCoach spreads ${k(189, 'en')} less across your meals.`,
    );
  });

  it('says more when yesterday was under, and that the rest comes later', () => {
    const under = carry({
      adjustment: 271,
      remaining: 129,
      yesterday: { date: '2026-11-12', consumed: 2311, target: 2711 },
    });
    expect(carryOverText(under, es, 'es')).toBe(
      `Ayer llegaste a ${n(2311)} de ${k(2711)}; hoy el iCoach reparte ${k(271)} más entre tus comidas. El resto se reparte en los próximos días.`,
    );
  });

  it('without yesterday (or pointing the other way) it names earlier days', () => {
    expect(carryOverText(carry({ adjustment: -129 }), es, 'es')).toBe(
      `Por lo que registraste en días anteriores, hoy el iCoach reparte ${k(129)} menos entre tus comidas.`,
    );
    expect(
      carryOverText(
        carry({ adjustment: 71, yesterday: { date: '2026-11-12', consumed: 2900, target: 2711 } }),
        en,
        'en',
      ),
    ).toBe(
      `Based on what you logged on earlier days, today the iCoach spreads ${k(71, 'en')} more across your meals.`,
    );
  });

  it('says nothing without an adjustment', () => {
    expect(carryOverText(null, es, 'es')).toBeNull();
    expect(carryOverText(carry({ adjustment: 0, remaining: -300 }), es, 'es')).toBeNull();
  });
});
