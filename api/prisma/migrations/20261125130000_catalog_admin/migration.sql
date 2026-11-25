-- ADR-P049 amendment 1: food catalogue management from the backoffice, and the
-- users.export permission.

-- A retired food revision is hidden from search and import, but stays valid:
-- meal items that reference it keep syncing (ADR-P012 revisions are immutable;
-- retiring never deletes). A correction retires the previous revision and adds
-- the next one under the same catalog_key.
ALTER TABLE "foods" ADD COLUMN "retired_at" TIMESTAMPTZ(6);
ALTER TABLE "foods" ADD COLUMN "retired_by_staff_id" UUID;

-- CSV export of the user list, separate from users.read. Only the system role
-- (SUPER_ADMIN) receives it; the owner grants it to other roles explicitly.
INSERT INTO "staff_permissions" ("key", "description") VALUES
  ('users.export',        'Exportar la lista de usuarios en CSV');

INSERT INTO "staff_role_permissions" ("role_id", "permission_key") VALUES
  ('00000000-0000-4000-8000-000000000001', 'users.export');
