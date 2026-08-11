-- Public-v1 wellness muscle-mass capture (ADR-P017 Slice 3B-1).
-- Additive and nullable so existing rows and older clients remain compatible.
ALTER TABLE "body_measurements"
  ADD COLUMN "muscle_mass_kg" DOUBLE PRECISION,
  ADD CONSTRAINT "chk_body_measurements_muscle_mass"
    CHECK ("muscle_mass_kg" IS NULL OR ("muscle_mass_kg" > 0 AND "muscle_mass_kg" <= 300));
