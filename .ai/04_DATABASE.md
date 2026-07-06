# AppFitness Database Architecture

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official data architecture for AppFitness.

It governs:

- SQLite
- PostgreSQL
- Prisma
- Synchronization
- Migrations
- Versioning
- Data integrity
- Security
- Performance

Every database modification must comply with this document.

---

# Philosophy

The database is a core business asset.

It must prioritize:

- Integrity
- Reliability
- Security
- Traceability
- Scalability
- Performance

Data loss is unacceptable.

---

# Database Strategy

AppFitness uses a dual-database architecture.

## Local Database

Engine

- Expo SQLite

Purpose

Primary operational database.

Responsible for:

- Offline mode
- Fast local access
- Immediate UI updates
- Cached information

SQLite is considered the source of truth while offline.

---

## Remote Database

Engine

- PostgreSQL

Purpose

Long-term persistence.

Centralized synchronization.

Analytics.

Reporting.

Cross-device synchronization.

---

# Synchronization Model

Architecture

Offline First

Flow

User

↓

SQLite

↓

Repository

↓

Sync Queue

↓

Background Sync Worker

↓

Backend API

↓

PostgreSQL

The UI must never depend directly on network availability.

---

# Synchronization Principles

Synchronization must be:

- Asynchronous
- Incremental
- Retryable
- Idempotent
- Observable
- Auditable

Never block user interactions.

---

# Local Database Responsibilities

SQLite stores:

- User profile
- Medical evaluations
- Physical evaluations
- Goals
- Nutrition plans
- Workout plans
- Progress history
- Coach recommendations
- Notifications
- Preferences
- Cached metadata

---

# Remote Database Responsibilities

PostgreSQL stores:

- Master records
- Synchronization history
- User accounts
- Device registrations
- Audit logs
- Analytics
- Backups
- Cross-device consistency

---

# Data Ownership

Every record must have:

- Primary identifier
- Owner
- Creation timestamp
- Update timestamp
- Synchronization status
- Version number

---

# Record Lifecycle

Each entity supports:

Created

Updated

Soft Deleted

Archived

Synchronized

Conflict

Failed Sync

Never permanently remove user-generated health data without explicit approval.

---

# Entity Design

Entities must be normalized.

Each entity requires:

Primary Key

Created At

Updated At

Version

Sync Status

Owner

Avoid duplicated information.

---

# Relationships

Use foreign keys whenever possible.

Maintain referential integrity.

Avoid orphan records.

Never duplicate relationships.

---

# Naming Conventions

Tables

snake_case

Columns

snake_case

Indexes

idx_table_column

Foreign Keys

fk_table_reference

Unique Constraints

uq_table_column

Primary Keys

pk_table

---

# Primary Keys

Use UUIDs whenever synchronization is required.

Never rely on auto-increment identifiers for synchronized entities.

---

# Indexing

Create indexes for:

Foreign Keys

Search fields

Synchronization status

Updated timestamps

Frequently queried columns

Measure performance before adding additional indexes.

---

# Constraints

Always enforce:

NOT NULL

UNIQUE

CHECK

FOREIGN KEY

Integrity must be enforced at the database level whenever appropriate.

---

# Transactions

Use transactions for:

Multiple writes

Synchronization

Relationship updates

History creation

Rollback on failure.

---

# Synchronization Queue

Every local modification generates a queue item.

Queue item contains:

- Entity
- Operation
- Timestamp
- Retry Count
- Payload
- Device ID
- User ID

---

# Conflict Resolution

Priority

1. User Safety

2. Medical Data Integrity

3. Data Consistency

4. Timestamp

Non-critical fields

Last Writer Wins

Critical medical information

Manual conflict resolution.

No automatic overwrite.

---

# Versioning

Each synchronized entity contains:

Version

Updated At

Sync Token

Conflict Flag

Never overwrite unknown versions.

---

# Historical Data

Health information is immutable.

Changes create history.

Never destroy historical measurements.

Support longitudinal analysis.

---

# Soft Deletes

Soft deletes are mandatory.

Fields

deleted_at

deleted_by

sync_status

The backend performs physical cleanup only after retention policies are satisfied.

---

# Data Validation

Validate:

Before insert

Before update

Before synchronization

Before API submission

Never trust client input.

---

# Medical Data

Medical records require:

High integrity

Encryption

Version tracking

Auditability

Never silently modify medical history.

---

# Encryption

Sensitive local information must be encrypted.

Protect:

Medical notes

Personal identifiers

Authentication tokens

Sensitive preferences

Encryption keys must never be hardcoded.

---

# Audit Trail

Critical operations must generate audit records.

Examples:

Medical evaluation

Goal modification

Synchronization conflict

Authentication

Profile changes

Deletion

Audit records are immutable.

---

# Performance

Optimize:

Indexes

Queries

Pagination

Batch operations

Transactions

Synchronization

Avoid N+1 queries.

Avoid full table scans.

---

# Repository Pattern

Only repositories may access persistence.

Presentation Layer

❌ Direct SQL

Application Layer

❌ Direct SQL

Domain Layer

❌ Direct SQL

Infrastructure

✅ Database Access

---

# Migrations

Every schema modification requires:

Migration

Rollback strategy

Version increment

Backward compatibility validation

Never edit historical migrations.

Create new ones.

---

# Backup Strategy

Server

Automated backups

Point-in-time recovery

Retention policy

Mobile

Synchronization guarantees recovery.

SQLite is considered recoverable.

---

# Data Retention

Medical history

Retained

Workout history

Retained

Nutrition history

Retained

Audit logs

Retained

Deletion requests follow applicable privacy regulations.

---

# Monitoring

Track:

Synchronization success

Synchronization failures

Migration failures

Database errors

Query performance

Storage growth

Conflict frequency

---

# Anti-Patterns

Never:

Duplicate business logic inside SQL

Store calculated values unnecessarily

Expose internal identifiers

Use raw SQL inside UI

Disable constraints

Delete historical medical records

Ignore synchronization failures

Overwrite conflicting health data

Store secrets in plaintext

---

# Database Quality Checklist

Every schema change must verify:

✓ Normalized

✓ Indexed

✓ Versioned

✓ Auditable

✓ Synchronizable

✓ Secure

✓ Backward Compatible

✓ Migration Included

✓ Repository Updated

✓ Tests Updated

---

# AI Instructions

Every AI agent must:

Treat SQLite as the operational database.

Treat PostgreSQL as the system of record.

Never bypass repositories.

Never modify schemas without migration planning.

Never propose denormalized structures without measurable justification.

Always preserve data integrity and synchronization compatibility.