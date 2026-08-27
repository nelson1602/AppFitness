-- AlterEnum
-- ADR-P026 Vertical 1: audit actions for password recovery. Recorded values
-- are user id + outcome only — never the address, the token, or the email body
-- (ADR-P026 Decision 9).
--
-- Kept in its own migration because PostgreSQL cannot use a newly added enum
-- value inside the same transaction that adds it; separating the ALTER TYPE
-- from any later DML that references these values keeps every deployment path
-- safe.
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_SUCCESS';
