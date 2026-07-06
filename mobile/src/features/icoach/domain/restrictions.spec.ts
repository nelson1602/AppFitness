import { analyzeRestrictions } from './restrictions';

describe('restriction analysis (medical safety has absolute priority)', () => {
  it('is permissive with no inputs', () => {
    expect(analyzeRestrictions([])).toEqual({
      blocked: false,
      requiresMedicalClearance: false,
      intensityCap: null,
      excludedMovements: [],
      triggeredRules: [],
    });
  });

  it('BLOCKS training entirely at crisis blood pressure (≥180/110)', () => {
    for (const bp of [
      { systolic: 185, diastolic: 95 },
      { systolic: 150, diastolic: 115 },
    ]) {
      const result = analyzeRestrictions([], bp);
      expect(result.blocked).toBe(true);
      expect(result.requiresMedicalClearance).toBe(true);
      expect(result.intensityCap).toBe('LOW');
      expect(result.triggeredRules).toContain('bp_crisis_block');
    }
  });

  it('caps LOW + clearance at stage-2 BP (≥160/100)', () => {
    const result = analyzeRestrictions([], { systolic: 165, diastolic: 95 });
    expect(result.blocked).toBe(false);
    expect(result.requiresMedicalClearance).toBe(true);
    expect(result.intensityCap).toBe('LOW');
  });

  it('caps MODERATE and excludes max-effort lifting at stage-1 BP (≥140/90)', () => {
    const result = analyzeRestrictions([], { systolic: 145, diastolic: 85 });
    expect(result.intensityCap).toBe('MODERATE');
    expect(result.excludedMovements).toContain('max_effort_lifts');
    expect(result.requiresMedicalClearance).toBe(false);
  });

  it('normal BP triggers nothing', () => {
    const result = analyzeRestrictions([], { systolic: 118, diastolic: 76 });
    expect(result.intensityCap).toBeNull();
    expect(result.triggeredRules).toHaveLength(0);
  });

  it('SEVERE restrictions cap LOW and require clearance', () => {
    const result = analyzeRestrictions([{ type: 'INJURY', severity: 'SEVERE' }]);
    expect(result.intensityCap).toBe('LOW');
    expect(result.requiresMedicalClearance).toBe(true);
  });

  it('MODERATE restrictions cap MODERATE without clearance', () => {
    const result = analyzeRestrictions([{ type: 'INJURY', severity: 'MODERATE' }]);
    expect(result.intensityCap).toBe('MODERATE');
    expect(result.requiresMedicalClearance).toBe(false);
  });

  it('DOCTOR_RESTRICTION always requires clearance, even when mild', () => {
    const result = analyzeRestrictions([{ type: 'DOCTOR_RESTRICTION', severity: 'MILD' }]);
    expect(result.requiresMedicalClearance).toBe(true);
    expect(result.triggeredRules).toContain('doctor_restriction_clearance');
  });

  it('maps body areas to movement exclusions (case-insensitive, deduped, sorted)', () => {
    const result = analyzeRestrictions([
      { type: 'INJURY', bodyArea: 'Knee', severity: 'MILD' },
      { type: 'INJURY', bodyArea: 'ankle', severity: 'MILD' },
    ]);
    expect(result.excludedMovements).toContain('deep_squat');
    expect(result.excludedMovements).toContain('running');
    // 'jumping' appears in both maps — deduped:
    expect(result.excludedMovements.filter((m) => m === 'jumping')).toHaveLength(1);
    expect([...result.excludedMovements]).toEqual([...result.excludedMovements].sort());
  });

  it('unknown body areas add no exclusions but severity still applies', () => {
    const result = analyzeRestrictions([
      { type: 'CONDITION', bodyArea: 'earlobe', severity: 'SEVERE' },
    ]);
    expect(result.excludedMovements).toHaveLength(0);
    expect(result.intensityCap).toBe('LOW');
  });

  it('the tightest cap wins when multiple rules fire', () => {
    const result = analyzeRestrictions(
      [{ type: 'INJURY', severity: 'MODERATE' }],
      { systolic: 165, diastolic: 95 }, // LOW cap
    );
    expect(result.intensityCap).toBe('LOW');
  });
});
