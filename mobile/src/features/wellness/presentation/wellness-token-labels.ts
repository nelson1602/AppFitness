import type { TranslationKey } from '@/shared/localization';

import {
  WELLNESS_AFFECTED_AREAS,
  WELLNESS_MOVEMENTS_TO_AVOID,
  type WellnessAffectedArea,
  type WellnessMovementToAvoid,
} from '../domain/wellness-safety-profile';

/**
 * EN/ES presentation labels for the two closed vocabularies (ADR-P017 **W-3**).
 *
 * W-1 fixed the tokens as stable, lowercase, language-neutral identifiers and
 * recorded that "presentation labels (EN/ES) belong to W-3 and never reach
 * storage". This module is that boundary and nothing more: it maps a token to a
 * localization key. It never maps a label back to a token, so a translated
 * string cannot become stored data, and switching language cannot change what
 * is persisted or normalized.
 *
 * Both maps are keyed by the token **union**, so adding a vocabulary token
 * without authoring both labels fails `tsc` rather than shipping an unlabelled
 * chip. `wellness-token-labels.spec.ts` additionally proves every token has a
 * non-empty entry in both catalogs, and that the two maps cover exactly the
 * shipped vocabularies.
 *
 * The area labels are **anatomical regions**, and the movement labels are
 * **movement patterns**. Neither is a condition, injury, cause, severity or
 * diagnosis: the label set carries exactly as little meaning as the tokens do.
 */

export const AFFECTED_AREA_LABEL_KEY: Record<WellnessAffectedArea, TranslationKey> = {
  abdomen: 'wellness.safety.area.abdomen',
  ankle: 'wellness.safety.area.ankle',
  chest: 'wellness.safety.area.chest',
  elbow: 'wellness.safety.area.elbow',
  foot: 'wellness.safety.area.foot',
  forearm: 'wellness.safety.area.forearm',
  groin: 'wellness.safety.area.groin',
  hand: 'wellness.safety.area.hand',
  hip: 'wellness.safety.area.hip',
  knee: 'wellness.safety.area.knee',
  lower_back: 'wellness.safety.area.lowerBack',
  lower_leg: 'wellness.safety.area.lowerLeg',
  neck: 'wellness.safety.area.neck',
  shoulder: 'wellness.safety.area.shoulder',
  thigh: 'wellness.safety.area.thigh',
  upper_arm: 'wellness.safety.area.upperArm',
  upper_back: 'wellness.safety.area.upperBack',
  wrist: 'wellness.safety.area.wrist',
};

export const MOVEMENT_LABEL_KEY: Record<WellnessMovementToAvoid, TranslationKey> = {
  bridging: 'wellness.safety.movement.bridging',
  deep_squat: 'wellness.safety.movement.deepSquat',
  dips: 'wellness.safety.movement.dips',
  front_rack_loading: 'wellness.safety.movement.frontRackLoading',
  good_morning: 'wellness.safety.movement.goodMorning',
  heavy_hinge: 'wellness.safety.movement.heavyHinge',
  heavy_pressing: 'wellness.safety.movement.heavyPressing',
  high_impact_cardio: 'wellness.safety.movement.highImpactCardio',
  jumping: 'wellness.safety.movement.jumping',
  loaded_carries: 'wellness.safety.movement.loadedCarries',
  loaded_spinal_flexion: 'wellness.safety.movement.loadedSpinalFlexion',
  lunge: 'wellness.safety.movement.lunge',
  max_effort_lifts: 'wellness.safety.movement.maxEffortLifts',
  overhead_press: 'wellness.safety.movement.overheadPress',
  running: 'wellness.safety.movement.running',
  skull_crushers: 'wellness.safety.movement.skullCrushers',
  sprinting: 'wellness.safety.movement.sprinting',
  valsalva_heavy_lifts: 'wellness.safety.movement.valsalvaHeavyLifts',
};

/** One selectable chip: the stored token plus the label the user reads. */
export interface WellnessTokenOption {
  readonly value: string;
  readonly label: string;
}

type Translate = (key: TranslationKey) => string;

/**
 * The chips for a token group, in the vocabulary's own (already alphabetical
 * by token) order.
 *
 * Order is deliberately **token order, not label order**: it is identical in
 * both languages, so a screenshot, a test and a user's muscle memory all agree
 * regardless of the active language. Sorting by translated label would make the
 * layout language-dependent for no benefit.
 */
export function affectedAreaOptions(t: Translate): WellnessTokenOption[] {
  return WELLNESS_AFFECTED_AREAS.map((value) => ({
    value,
    label: t(AFFECTED_AREA_LABEL_KEY[value]),
  }));
}

export function movementOptions(t: Translate): WellnessTokenOption[] {
  return WELLNESS_MOVEMENTS_TO_AVOID.map((value) => ({
    value,
    label: t(MOVEMENT_LABEL_KEY[value]),
  }));
}
