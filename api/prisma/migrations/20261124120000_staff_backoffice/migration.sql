-- ADR-P049 (staff backoffice, PR 1). Additive only: new enums and tables, no
-- change to any existing table. Staff accounts are a separate identity from
-- app users (no foreign key to "users").

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "StaffSessionStage" AS ENUM ('MFA_PENDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(120),
    "password_hash" TEXT,
    "totp_secret_enc" BYTEA,
    "totp_enabled_at" TIMESTAMPTZ(6),
    "totp_last_step" BIGINT,
    "role_id" UUID NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'INVITED',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_roles" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_permissions" (
    "key" VARCHAR(64) NOT NULL,
    "description" VARCHAR(200) NOT NULL,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "staff_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,

    CONSTRAINT "staff_role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "staff_invites" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "stage" "StaffSessionStage" NOT NULL,
    "session_version" INTEGER NOT NULL,
    "mfa_failures" INTEGER NOT NULL DEFAULT 0,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_audit_logs" (
    "id" UUID NOT NULL,
    "staff_id" UUID,
    "staff_email" VARCHAR(320),
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_users_email" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "idx_staff_users_role" ON "staff_users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_roles_key" ON "staff_roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_roles_name" ON "staff_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_invites_token_hash" ON "staff_invites"("token_hash");

-- CreateIndex
CREATE INDEX "idx_staff_invites_staff" ON "staff_invites"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_sessions_token_hash" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_staff_sessions_staff" ON "staff_sessions"("staff_id");

-- CreateIndex
CREATE INDEX "idx_staff_sessions_expires" ON "staff_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_staff_audit_logs_created" ON "staff_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_staff_audit_logs_staff_created" ON "staff_audit_logs"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_staff_audit_logs_action_created" ON "staff_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_staff_audit_logs_target" ON "staff_audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "fk_staff_users_role" FOREIGN KEY ("role_id") REFERENCES "staff_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_role_permissions" ADD CONSTRAINT "fk_staff_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "staff_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_role_permissions" ADD CONSTRAINT "fk_staff_role_permissions_permission" FOREIGN KEY ("permission_key") REFERENCES "staff_permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "fk_staff_invites_staff" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "fk_staff_sessions_staff" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Seed: the 12 permissions and the SUPER_ADMIN system role ────────────────
INSERT INTO "staff_permissions" ("key", "description") VALUES
  ('users.read',          'Ver la lista y el detalle de usuarios (solo cuenta y soporte)'),
  ('users.support',       'Reenviar verificación, enviar restablecimiento, desbloquear, cerrar sesiones'),
  ('users.suspend',       'Suspender y reactivar cuentas'),
  ('users.delete',        'Eliminar cuentas de forma permanente'),
  ('subscriptions.read',  'Ver el estado de suscripción'),
  ('subscriptions.grant', 'Otorgar o retirar Pro promocional'),
  ('metrics.read',        'Ver el panel de métricas'),
  ('catalog.manage',      'Gestionar el catálogo de ejercicios y alimentos'),
  ('config.manage',       'Gestionar la configuración de la app'),
  ('audit.read',          'Ver el registro de auditoría'),
  ('staff.manage',        'Gestionar el personal (solo SUPER_ADMIN)'),
  ('roles.manage',        'Gestionar roles y permisos (solo SUPER_ADMIN)');

INSERT INTO "staff_roles" ("id", "key", "name", "description", "is_system", "updated_at") VALUES
  ('00000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'Propietario',
   'Rol del sistema: todos los permisos. No se puede editar, eliminar ni asignar.', true, CURRENT_TIMESTAMP);

INSERT INTO "staff_role_permissions" ("role_id", "permission_key")
  SELECT '00000000-0000-4000-8000-000000000001', "key" FROM "staff_permissions";

-- ─── Integrity triggers (defense in depth behind the service checks) ─────────

-- A system role is immutable and cannot be deleted.
CREATE FUNCTION reject_system_role_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'staff_roles: system role % is immutable', OLD.key;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.is_system THEN
    RAISE EXCEPTION 'staff_roles: a role cannot become a system role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_roles_system_immutable
  BEFORE UPDATE OR DELETE ON "staff_roles"
  FOR EACH ROW EXECUTE FUNCTION reject_system_role_mutation();

-- A system role keeps every permission it has; staff.manage and roles.manage
-- belong to system roles only.
CREATE FUNCTION check_staff_role_permission() RETURNS trigger AS $$
DECLARE
  role_is_system BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT is_system INTO role_is_system FROM "staff_roles" WHERE id = OLD.role_id;
    IF role_is_system THEN
      RAISE EXCEPTION 'staff_role_permissions: a system role keeps its permissions';
    END IF;
    RETURN OLD;
  END IF;
  SELECT is_system INTO role_is_system FROM "staff_roles" WHERE id = NEW.role_id;
  IF NOT role_is_system AND NEW.permission_key IN ('staff.manage', 'roles.manage') THEN
    RAISE EXCEPTION 'staff_role_permissions: % is reserved for the system role', NEW.permission_key;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'staff_role_permissions: rows are inserted or deleted, never updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_role_permissions_check
  BEFORE INSERT OR UPDATE OR DELETE ON "staff_role_permissions"
  FOR EACH ROW EXECUTE FUNCTION check_staff_role_permission();

-- A staff member holding a system role cannot be deleted, disabled or moved to
-- another role; nobody else can be moved into a system role.
CREATE FUNCTION protect_system_staff() RETURNS trigger AS $$
DECLARE
  old_system BOOLEAN;
  new_system BOOLEAN;
BEGIN
  SELECT is_system INTO old_system FROM "staff_roles" WHERE id = OLD.role_id;
  IF TG_OP = 'DELETE' THEN
    IF old_system THEN
      RAISE EXCEPTION 'staff_users: the owner account cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  SELECT is_system INTO new_system FROM "staff_roles" WHERE id = NEW.role_id;
  IF old_system AND (NEW.role_id <> OLD.role_id OR NEW.status = 'DISABLED') THEN
    RAISE EXCEPTION 'staff_users: the owner account cannot be demoted or disabled';
  END IF;
  IF new_system AND NOT old_system THEN
    RAISE EXCEPTION 'staff_users: a system role cannot be assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_users_protect_system
  BEFORE UPDATE OR DELETE ON "staff_users"
  FOR EACH ROW EXECUTE FUNCTION protect_system_staff();

-- The staff audit trail is append-only, with no exception.
CREATE FUNCTION reject_staff_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'staff_audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "staff_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_staff_audit_mutation();

-- TRUNCATE bypasses row triggers; refuse it as well.
CREATE TRIGGER trg_staff_audit_logs_no_truncate
  BEFORE TRUNCATE ON "staff_audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_staff_audit_mutation();
