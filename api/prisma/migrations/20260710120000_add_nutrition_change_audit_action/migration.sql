-- AlterEnum
-- ADR-P012 Slice 4A: single additive audit action for nutrition changes.
ALTER TYPE "AuditAction" ADD VALUE 'NUTRITION_CHANGE';
