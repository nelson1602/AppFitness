-- AlterEnum
-- ADR-P026 Vertical 2 (V2-A): audit actions for email verification. Recorded
-- values are user id + outcome only — never the address, the token, or the
-- email body (ADR-P026 Decision 9).
--
-- Kept in its own migration because PostgreSQL cannot use a newly added enum
-- value inside the same transaction that adds it; separating the ALTER TYPE
-- from any later DML that references these values keeps every deployment path
-- safe. This mirrors migration 20260827120000 (password recovery).
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFICATION_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFICATION_SUCCESS';
