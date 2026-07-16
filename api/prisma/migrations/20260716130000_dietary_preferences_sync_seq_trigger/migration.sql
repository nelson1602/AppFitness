-- ADR-P014 / FEATURE-006 Slice 2A — attach the sync_seq trigger to
-- dietary_preferences. Forward-only, additive fix for a Slice 1 gap: the
-- Slice 1 table (20260716120000_add_dietary_preferences) created the
-- `sync_seq` column (default 0) but did NOT attach the shared
-- `assign_sync_seq()` BEFORE INSERT/UPDATE trigger that every other synced
-- table has. Without it `sync_seq` stays 0 and the sync handler's incremental
-- pull (`sync_seq > cursor`) would never surface changes. The
-- `sync_seq_global` sequence and `assign_sync_seq()` function already exist
-- (created in 20260703181824_init). Shipped migrations are never edited.

CREATE TRIGGER trg_dietary_preferences_sync_seq
  BEFORE INSERT OR UPDATE ON "dietary_preferences"
  FOR EACH ROW EXECUTE FUNCTION assign_sync_seq();
