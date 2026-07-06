import { BloodPressure, Intensity, RestrictionInput } from './types';

/**
 * Medical restriction analysis — the highest-priority rule group
 * (.ai/07_ICOACH.md Rule Priority: medical safety overrides everything).
 * Deterministic mappings only; no free-text interpretation (structured
 * restriction data comes from the medical feature).
 */

export interface RestrictionAnalysis {
  /** Training must not proceed at all without medical clearance. */
  blocked: boolean;
  requiresMedicalClearance: boolean;
  /** Hard ceiling on intensity (null = no cap from restrictions). */
  intensityCap: Intensity | null;
  excludedMovements: string[];
  /** Deterministic keys of every safety rule that fired (explainability). */
  triggeredRules: string[];
}

/** Body area → movement patterns excluded while the restriction is active. */
export const BODY_AREA_EXCLUSIONS: Record<string, string[]> = {
  knee: ['jumping', 'deep_squat', 'lunge', 'high_impact_cardio'],
  shoulder: ['overhead_press', 'behind_neck_press', 'dips'],
  back: ['heavy_hinge', 'loaded_spinal_flexion', 'good_morning'],
  lower_back: ['heavy_hinge', 'loaded_spinal_flexion', 'good_morning'],
  hip: ['deep_squat', 'high_impact_cardio', 'sprinting'],
  ankle: ['jumping', 'running', 'high_impact_cardio'],
  wrist: ['heavy_pressing', 'front_rack_loading'],
  elbow: ['heavy_pressing', 'skull_crushers'],
  neck: ['overhead_press', 'loaded_carries', 'bridging'],
};

// Blood-pressure safety thresholds (ACSM guidance).
const BP_BLOCK = { systolic: 180, diastolic: 110 };
const BP_MODERATE_CAP = { systolic: 160, diastolic: 100 };
const BP_HIGH_NORMAL = { systolic: 140, diastolic: 90 };

export function analyzeRestrictions(
  restrictions: RestrictionInput[],
  bloodPressure?: BloodPressure,
): RestrictionAnalysis {
  const triggeredRules: string[] = [];
  const excluded = new Set<string>();
  let intensityCap: Intensity | null = null;
  let requiresMedicalClearance = false;
  let blocked = false;

  const capAt = (cap: Intensity): void => {
    const order: Intensity[] = ['LOW', 'MODERATE', 'HIGH'];
    if (intensityCap === null || order.indexOf(cap) < order.indexOf(intensityCap)) {
      intensityCap = cap;
    }
  };

  // 1. Blood pressure — absolute priority.
  if (bloodPressure) {
    const { systolic, diastolic } = bloodPressure;
    if (systolic >= BP_BLOCK.systolic || diastolic >= BP_BLOCK.diastolic) {
      blocked = true;
      requiresMedicalClearance = true;
      capAt('LOW');
      triggeredRules.push('bp_crisis_block');
    } else if (systolic >= BP_MODERATE_CAP.systolic || diastolic >= BP_MODERATE_CAP.diastolic) {
      requiresMedicalClearance = true;
      capAt('LOW');
      triggeredRules.push('bp_stage2_low_cap');
    } else if (systolic >= BP_HIGH_NORMAL.systolic || diastolic >= BP_HIGH_NORMAL.diastolic) {
      capAt('MODERATE');
      excluded.add('max_effort_lifts');
      excluded.add('valsalva_heavy_lifts');
      triggeredRules.push('bp_stage1_moderate_cap');
    }
  }

  // 2. Structured restrictions.
  for (const restriction of restrictions) {
    if (restriction.severity === 'SEVERE') {
      requiresMedicalClearance = true;
      capAt('LOW');
      triggeredRules.push(`severe_${restriction.type.toLowerCase()}_low_cap`);
    } else if (restriction.severity === 'MODERATE') {
      capAt('MODERATE');
      triggeredRules.push(`moderate_${restriction.type.toLowerCase()}_cap`);
    }

    if (restriction.type === 'DOCTOR_RESTRICTION') {
      // Doctor restrictions always require clearance before intensifying.
      requiresMedicalClearance = true;
      if (!triggeredRules.includes('doctor_restriction_clearance')) {
        triggeredRules.push('doctor_restriction_clearance');
      }
    }

    const area = restriction.bodyArea?.toLowerCase().trim();
    if (area && BODY_AREA_EXCLUSIONS[area]) {
      for (const movement of BODY_AREA_EXCLUSIONS[area]) excluded.add(movement);
      triggeredRules.push(`exclusions_${area}`);
    }
  }

  return {
    blocked,
    requiresMedicalClearance,
    intensityCap,
    excludedMovements: [...excluded].sort(),
    triggeredRules,
  };
}
