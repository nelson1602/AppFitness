import { formatKcalQuantity, formatNumber } from '@/shared/localization';
import { en as EN } from '@/shared/localization/resources/en';
import { es as ES } from '@/shared/localization/resources/es';

import { CARRY_OVER_RULE_VERSION, type CarryOver } from '../domain/carry-over';
import { carryOverText, type CarryOverMessage } from './carry-over-copy';

// The device (Hermes) reads "3.200"; Node's `es` locale does not group four
// digits. Expectations use the app's own formatters (units take a NBSP).
const n = (value: number) => formatNumber(value, 'es');
const k = (value: number, language: 'es' | 'en' = 'es') => formatKcalQuantity(value, language);

const message = (overrides: Partial<CarryOver>, cardioMinutesToday = 0): CarryOverMessage => ({
  carryOver: {
    ruleVersion: CARRY_OVER_RULE_VERSION,
    adjustment: 0,
    yesterday: null,
    remaining: 0,
    cardio: [],
    ...overrides,
  },
  cardioMinutesToday,
});

describe('the one carry-over sentence (ADR-P040 Addendum v11-B)', () => {
  const es = (key: string) => (ES as Record<string, string>)[key] ?? key;
  const en = (key: string) => (EN as Record<string, string>)[key] ?? key;
  const over = { date: '2026-11-12', consumed: 3200, target: 2711 };

  it('food and cardio in one sentence, es + en', () => {
    const both = message({ adjustment: -271, yesterday: over }, 20);
    expect(carryOverText(both, es, 'es')).toBe(
      `Ayer llegaste a ${n(3200)} de ${k(2711)}. Hoy el iCoach reparte ${k(271)} menos entre tus comidas y suma 20 min de cardio suave a tu próximo entrenamiento.`,
    );
    expect(carryOverText(both, en, 'en')).toBe(
      `Yesterday you reached 3,200 of ${k(2711, 'en')}. Today the iCoach spreads ${k(271, 'en')} less across your meals and adds 20 min of easy cardio to your next workout.`,
    );
  });

  it('omits the cardio clause when only food changes (or the block was removed)', () => {
    const foodOnly = message({
      adjustment: -136,
      yesterday: { date: '2026-11-12', consumed: 2847, target: 2711 },
    });
    expect(carryOverText(foodOnly, es, 'es')).toBe(
      `Ayer llegaste a ${n(2847)} de ${k(2711)}. Hoy el iCoach reparte ${k(136)} menos entre tus comidas.`,
    );
  });

  it('cardio only, when the safe minimum leaves no room for less food', () => {
    expect(carryOverText(message({ adjustment: 0, yesterday: over }, 30), es, 'es')).toBe(
      `Ayer llegaste a ${n(3200)} de ${k(2711)}. Hoy el iCoach suma 30 min de cardio suave a tu próximo entrenamiento.`,
    );
  });

  it('says more when yesterday was under, and that the rest comes later', () => {
    const under = message({
      adjustment: 271,
      remaining: 136,
      yesterday: { date: '2026-11-12', consumed: 2304, target: 2711 },
    });
    expect(carryOverText(under, es, 'es')).toBe(
      `Ayer llegaste a ${n(2304)} de ${k(2711)}. Hoy el iCoach reparte ${k(271)} más entre tus comidas. El resto se reparte en los próximos días.`,
    );
  });

  it('without yesterday (or pointing the other way) it names earlier days', () => {
    expect(carryOverText(message({ adjustment: 129 }), es, 'es')).toBe(
      `Por lo que registraste en días anteriores, hoy el iCoach reparte ${k(129)} más entre tus comidas.`,
    );
    expect(carryOverText(message({ adjustment: 71, yesterday: over }), en, 'en')).toBe(
      `Based on what you logged on earlier days, today the iCoach spreads ${k(71, 'en')} more across your meals.`,
    );
  });

  it('says nothing when today does not change', () => {
    expect(carryOverText(null, es, 'es')).toBeNull();
    expect(carryOverText(message({ adjustment: 0 }), es, 'es')).toBeNull();
  });
});
