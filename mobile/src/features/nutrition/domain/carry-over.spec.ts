import {
  CARRY_OVER_RULE_VERSION,
  computeCarryOver,
  type CarryOverInput,
  type DayIntake,
} from './carry-over';

const BASE = 2711;
const FLOOR = 1792; // the safe minimum of a 80 kg / 175 cm adult (BMR > clinical floor)
const TODAY = '2026-11-13';

const day = (date: string, calories: number, items = 3): DayIntake => ({ date, calories, items });
const run = (days: DayIntake[], extra: Partial<CarryOverInput> = {}) =>
  computeCarryOver({ today: TODAY, baseCalories: BASE, floorCalories: FLOOR, days, ...extra });

describe('carry-over@1.0.0 (ADR-P040 Addendum v11-B)', () => {
  it('over by 189 yesterday: today plans 189 kcal less', () => {
    expect(run([day('2026-11-12', 2900)])).toEqual({
      ruleVersion: CARRY_OVER_RULE_VERSION,
      adjustment: -189,
      yesterday: { date: '2026-11-12', consumed: 2900, target: 2711 },
      remaining: 0,
    });
  });

  it('under by 400 yesterday: capped at 10 % (271) today, the rest tomorrow', () => {
    const today = run([day('2026-11-12', 2311)]);
    expect(today.adjustment).toBe(271);
    expect(today.remaining).toBe(129);
    const tomorrow = computeCarryOver({
      today: '2026-11-14',
      baseCalories: BASE,
      floorCalories: FLOOR,
      days: [day('2026-11-12', 2311), day('2026-11-13', 2982)],
    });
    expect(tomorrow.adjustment).toBe(129);
    expect(tomorrow.yesterday).toEqual({ date: '2026-11-13', consumed: 2982, target: 2982 });
  });

  it('over by 900: spread over three days at 10 % each, the last 87 dropped', () => {
    const logs = [day('2026-11-12', 3611)];
    const adjustments: number[] = [];
    for (const [index, date] of [
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ].entries()) {
      const result = computeCarryOver({
        today: date,
        baseCalories: BASE,
        floorCalories: FLOOR,
        days: logs,
      });
      adjustments.push(result.adjustment);
      // Each day is eaten exactly at its adjusted target: no new difference.
      logs.push(day(date, BASE + result.adjustment));
      if (index === 0) expect(result.remaining).toBe(-629);
    }
    expect(adjustments).toEqual([-271, -271, -271, 0]);
  });

  it('a day with nothing logged adds no difference', () => {
    expect(run([])).toMatchObject({ adjustment: 0, yesterday: null, remaining: 0 });
    expect(run([day('2026-11-12', 0, 0)])).toMatchObject({ adjustment: 0, yesterday: null });
  });

  it('an unlogged yesterday used its share; the rest of an earlier day still comes', () => {
    // 11-11: 400 over → 11-12 (nothing logged) planned 271 less; today the last 129.
    const result = run([day('2026-11-11', 3111)]);
    expect(result.adjustment).toBe(-129);
    expect(result.yesterday).toBeNull();
  });

  it('never below the safe minimum', () => {
    const near = computeCarryOver({
      today: TODAY,
      baseCalories: 1600,
      floorCalories: 1500,
      days: [day('2026-11-12', 2000)],
    });
    expect(near.adjustment).toBe(-100);
    const atFloor = computeCarryOver({
      today: TODAY,
      baseCalories: 1500,
      floorCalories: 1500,
      days: [day('2026-11-12', 2000)],
    });
    expect(atFloor.adjustment).toBe(0);
  });

  it('never above +10 % of the base, even with several days under', () => {
    const result = run([day('2026-11-10', 2000), day('2026-11-11', 2000), day('2026-11-12', 2000)]);
    expect(result.adjustment).toBe(271);
  });

  it('a new difference first cancels the opposite one still queued', () => {
    // 11-11: 500 over → 11-12 plans 2.440; eaten 2.140 → 300 under cancels the
    // 229 still queued, so today gets +71.
    const result = run([day('2026-11-11', 3211), day('2026-11-12', 2140)]);
    expect(result.yesterday).toEqual({ date: '2026-11-12', consumed: 2140, target: 2440 });
    expect(result.adjustment).toBe(71);
    expect(result.remaining).toBe(0);
  });

  it("yesterday's extra-cardio bonus is part of yesterday's target", () => {
    const result = run([day('2026-11-12', 3011)], { bonusByDate: { '2026-11-12': 300 } });
    expect(result.adjustment).toBe(0);
    expect(result.yesterday).toEqual({ date: '2026-11-12', consumed: 3011, target: 3011 });
  });

  it('only the last seven days count, and the base target is an input only', () => {
    expect(run([day('2026-11-05', 4000)]).adjustment).toBe(0);
    const input: CarryOverInput = {
      today: TODAY,
      baseCalories: BASE,
      floorCalories: FLOOR,
      days: [day('2026-11-12', 2900)],
    };
    const frozen = JSON.stringify(input);
    expect(computeCarryOver(input)).toEqual(computeCarryOver(input));
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
