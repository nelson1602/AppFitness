-- v8 Block 2 / ADR-P040 D5 — three new injury values for the first-run
-- evaluation: muscle_tear (Desgarre muscular), shin_splints (Periostitis
-- tibial) and plantar_fasciitis (Fascitis plantar). Additive: the allowlist
-- grows, every existing row stays valid. Mirrors SQLite migration 008.
ALTER TABLE "wellness_safety_profiles"
  DROP CONSTRAINT "chk_wellness_safety_profiles_affected_areas";

ALTER TABLE "wellness_safety_profiles"
  ADD CONSTRAINT "chk_wellness_safety_profiles_affected_areas"
    CHECK (
      coalesce(array_ndims("affected_areas"), 1) = 1
      AND cardinality("affected_areas") <= 64
      AND array_position("affected_areas", NULL) IS NULL
      AND array_position("affected_areas", '') IS NULL
      AND "affected_areas"::text = lower("affected_areas"::text)
      AND "affected_areas" <@ ARRAY[
        'abdomen', 'ankle', 'chest', 'elbow', 'foot', 'forearm', 'groin',
        'hand', 'hip', 'knee', 'lower_back', 'lower_leg', 'muscle_tear',
        'neck', 'plantar_fasciitis', 'shin_splints', 'shoulder', 'thigh',
        'upper_arm', 'upper_back', 'wrist'
      ]::text[]
    );
