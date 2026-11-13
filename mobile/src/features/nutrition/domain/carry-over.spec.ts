import {
  CARRY_OVER_RULE_VERSION,
  cardioMinutes,
  computeCarryOver,
  type CarryOverInput,
  type DayIntake,
} from './carry-over';

const BASE = 2711;
const FLOOR = 1792; // the safe minimum of a 80 kg / 175 cm adult (BMR > clinical floor)
const TODAY = '2026-11-13';
const YESTERDAY = '2026-11-12';

const day = (date: string, calories: number, items = 3): DayIntake => ({ date, calories, items });
const run = (days: DayIntake[], extra: Partial<CarryOverInput> = {}) =>
  computeCarryOver({
    today: TODAY,
    baseCalories: BASE,
    floorCalories: FLOOR,
    days,
    weightKg: 80,
    cardioAllowed: true,
    ...extra,
  });

describe('carry-over@1.0.0 (ADR-P040 Addendum v11-B)', () => {
  it('over by 5 %: food only, today plans that much less', () => {
    expect(run([day(YESTERDAY, 2847)])).toEqual({
      ruleVersion: CARRY_OVER_RULE_VERSION,
      adjustment: -136,
      yesterday: { date: YESTERDAY, consumed: 2847, target: 2711 },
      remaining: 0,
      cardio: [],
    });
  });

  it('over by 18 %: food takes 10 % today, the rest becomes cardio (no double counting)', () => {
    const result = run([day(YESTERDAY, 3199)]); // 488 over
    expect(result.adjustment).toBe(-271);
    expect(result.cardio).toEqual([{ fromDate: YESTERDAY, kcal: 217, minutes: 30 }]);
    // 271 by food + 217 by cardio = the 488 over, each kcal once.
    expect(-result.adjustment + result.cardio[0].kcal).toBe(488);
    expect(result.remaining).toBe(0);
  });

  it('cardio minutes follow the workout calorie model: net MET × kg, 5-minute steps', () => {
    // Brisk walk, net (3,5 − 1) × 80 kg = 200 kcal an hour.
    expect(cardioMinutes(54, 80)).toBe(15);
    expect(cardioMinutes(67, 80)).toBe(20);
    expect(cardioMinutes(5, 80)).toBe(0);
  });

  it('a very large excess: 30 minutes at most, the rest dropped, no more reduced days', () => {
    const logs = [day(YESTERDAY, 4711)]; // 2.000 over
    const today = run(logs);
    expect(today.adjustment).toBe(-271);
    expect(today.cardio).toEqual([{ fromDate: YESTERDAY, kcal: 1729, minutes: 30 }]);
    const tomorrow = computeCarryOver({
      today: '2026-11-14',
      baseCalories: BASE,
      floorCalories: FLOOR,
      days: [...logs, day(TODAY, BASE - 271)],
      weightKg: 80,
    });
    expect(tomorrow.adjustment).toBe(0);
  });

  it('under by 15 %: food goes up at most 10 % a day, spread; the workout is unchanged', () => {
    const today = run([day(YESTERDAY, 2304)]); // 407 under
    expect(today.adjustment).toBe(271);
    expect(today.remaining).toBe(136);
    expect(today.cardio).toEqual([]);
    const tomorrow = computeCarryOver({
      today: '2026-11-14',
      baseCalories: BASE,
      floorCalories: FLOOR,
      days: [day(YESTERDAY, 2304), day(TODAY, 2982)],
    });
    expect(tomorrow.adjustment).toBe(136);
  });

  it('a restriction for that kind of exercise: no cardio, the food part only', () => {
    const result = run([day(YESTERDAY, 3199)], { cardioAllowed: false });
    expect(result.adjustment).toBe(-271);
    expect(result.cardio).toEqual([]);
  });

  it('no known weight: no cardio minutes can be given', () => {
    expect(run([day(YESTERDAY, 3199)], { weightKg: null }).cardio).toEqual([]);
  });

  it('a day with nothing logged adds nothing', () => {
    expect(run([])).toMatchObject({ adjustment: 0, yesterday: null, remaining: 0, cardio: [] });
    expect(run([day(YESTERDAY, 0, 0)])).toMatchObject({ adjustment: 0, yesterday: null });
  });

  it('the food part of a day over applies the next day only', () => {
    // 11-11: 400 over → 11-12 (nothing logged) planned 271 less; today nothing.
    const result = run([day('2026-11-11', 3111)]);
    expect(result.adjustment).toBe(0);
    // Its 129 kcal beyond 10 % went to cardio (39 min, capped at 30).
    expect(result.cardio).toEqual([{ fromDate: '2026-11-11', kcal: 129, minutes: 30 }]);
  });

  it('never below the safe minimum', () => {
    const near = computeCarryOver({
      today: TODAY,
      baseCalories: 1600,
      floorCalories: 1500,
      days: [day(YESTERDAY, 1700)],
    });
    expect(near.adjustment).toBe(-100);
    const atFloor = computeCarryOver({
      today: TODAY,
      baseCalories: 1500,
      floorCalories: 1500,
      days: [day(YESTERDAY, 1600)],
    });
    expect(atFloor.adjustment).toBe(0);
  });

  it('never above +10 % of the base, even with several days under', () => {
    const result = run([day('2026-11-10', 2000), day('2026-11-11', 2000), day(YESTERDAY, 2000)]);
    expect(result.adjustment).toBe(271);
  });

  it('a day over first cancels food still queued from a day under', () => {
    // 11-11: 500 under → 11-12 plans 2.982 (+271, 229 still queued); eaten
    // 3.182 → 200 over cancels 200 of the 229, so today gets the last +29.
    const result = run([day('2026-11-11', 2211), day(YESTERDAY, 3182)]);
    expect(result.yesterday).toEqual({ date: YESTERDAY, consumed: 3182, target: 2982 });
    expect(result.adjustment).toBe(29);
    expect(result.cardio).toEqual([]);
  });

  it("yesterday's extra-cardio bonus is part of yesterday's target", () => {
    const result = run([day(YESTERDAY, 3011)], { bonusByDate: { [YESTERDAY]: 300 } });
    expect(result.adjustment).toBe(0);
    expect(result.yesterday).toEqual({ date: YESTERDAY, consumed: 3011, target: 3011 });
  });

  it('only the last seven days count, and the base target is an input only', () => {
    expect(run([day('2026-11-05', 4000)]).adjustment).toBe(0);
    const input: CarryOverInput = {
      today: TODAY,
      baseCalories: BASE,
      floorCalories: FLOOR,
      days: [day(YESTERDAY, 2900)],
      weightKg: 80,
    };
    const frozen = JSON.stringify(input);
    expect(computeCarryOver(input)).toEqual(computeCarryOver(input));
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
