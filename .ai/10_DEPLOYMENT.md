# AppFitness Deployment & Release Engineering Handbook

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official deployment, release, infrastructure, CI/CD, mobile build, monitoring, rollback, and production readiness strategy for AppFitness.

Every release must comply with this handbook.

Deployment is not only about shipping code. It is about safely delivering reliable software to users without compromising data integrity, security, or availability.

---

# Deployment Philosophy

AppFitness must be released using a predictable, automated, auditable, and rollback-safe process.

Every deployment must prioritize:

* Stability
* Security
* Data integrity
* Observability
* Reproducibility
* Rollback capability
* Minimal manual intervention

Production releases must never depend on undocumented manual steps.

---

# Target Environments

AppFitness supports the following environments:

## Local

Used for developer machines.

Purpose:

* Development
* Debugging
* Local testing
* Feature implementation

---

## Development

Shared non-production environment.

Purpose:

* Early integration
* Internal testing
* API validation
* Mobile development builds

---

## Staging

Production-like environment.

Purpose:

* Release validation
* QA testing
* E2E testing
* Performance testing
* Migration validation
* Store build validation

---

## Production

Live user-facing environment.

Purpose:

* Real users
* Real health data
* Secure operations
* Stable releases

Production must always be treated as sensitive.

---

# Deployment Architecture

AppFitness deployment includes:

* Mobile application
* Backend API
* PostgreSQL database
* Redis cache
* Background workers
* Object storage
* Monitoring
* Logging
* CI/CD pipelines
* Secrets management

---

# Mobile Release Strategy

Mobile builds use:

* Expo
* EAS Build
* EAS Submit
* Expo Updates

Supported platforms:

* iOS
* Android

---

# Mobile Build Types

## Development Build

Used for local and internal development.

Includes:

* Debug tools
* Development client
* Internal testing configuration

---

## Preview Build

Used for QA and stakeholder review.

Includes:

* Staging API
* Production-like behavior
* Limited debugging

---

## Production Build

Used for App Store and Google Play.

Includes:

* Production API
* Optimized assets
* Secure configuration
* Crash reporting
* Monitoring
* No debug tools

---

# OTA Updates

Expo Updates may be used for safe JavaScript and asset updates.

OTA updates must never:

* Break native compatibility
* Require missing native modules
* Change database schema without migration support
* Bypass store review for policy-sensitive changes
* Introduce incompatible API behavior

Every OTA update must be backward compatible with the installed binary.

---

# Native Build Policy

A new native build is required when changing:

* Expo SDK version
* Native dependencies
* Permissions
* App icons
* Splash screen
* Deep link schemes
* Push notification configuration
* Secure storage behavior
* Background task behavior
* Native modules

---

# App Store / Google Play Readiness

Before store submission verify:

* App version updated
* Build number updated
* Privacy policy available
* Terms of service available
* Health data disclaimers included
* App permissions justified
* Screenshots prepared
* Metadata reviewed
* Crash reporting enabled
* Production API configured
* No debug screens exposed
* No test credentials included

---

# Backend Deployment Strategy

Backend uses:

* NestJS
* PostgreSQL
* Prisma
* Redis
* BullMQ
* Docker
* Docker Compose
* Nginx or equivalent reverse proxy

Production backend deployments must be automated.

---

# Backend Runtime Requirements

The backend must support:

* Health checks
* Graceful shutdown
* Environment-based configuration
* Structured logging
* Rate limiting
* Request validation
* Error monitoring
* Database migrations
* Background workers

---

# Containerization

Docker is required for backend infrastructure consistency.

Containers should be:

* Minimal
* Reproducible
* Secure
* Versioned
* Environment agnostic

Do not store secrets inside images.

---

# Docker Compose

Docker Compose may be used for:

* Local development
* Staging simulation
* Developer onboarding
* Integration testing

Production may use a more robust orchestration platform in the future.

---

# CI/CD

CI/CD must be implemented using GitHub Actions unless replaced by an approved ADR.

CI/CD must include:

* Install dependencies
* Type checking
* Linting
* Formatting check
* Unit tests
* Integration tests
* Build validation
* Security checks
* Deployment gates

---

# CI Pipeline

Every pull request must run:

* TypeScript check
* ESLint
* Prettier check
* Unit tests
* Relevant integration tests
* Dependency audit
* Build verification

Pull requests must not be merged when CI fails.

---

# Release Pipeline

Release pipeline must run:

* Full test suite
* Backend build
* Mobile build validation
* Database migration validation
* Security audit
* Smoke tests
* Version verification
* Deployment approval gate

---

# Branch Strategy

Use GitHub Flow.

Primary branch:

* main

Allowed branch prefixes:

* feature/
* fix/
* refactor/
* hotfix/
* docs/
* test/
* chore/
* release/

Production deployments must originate from main or an approved release branch.

---

# Versioning

Use Semantic Versioning.

Format:

MAJOR.MINOR.PATCH

MAJOR

Breaking changes.

MINOR

Backward-compatible features.

PATCH

Bug fixes.

Mobile build numbers must increase with every store submission.

---

# Environment Variables

Environment variables must be managed per environment.

Never hardcode configuration.

Examples:

* API URLs
* Database URLs
* Redis URLs
* JWT secrets
* Encryption keys
* Storage credentials
* Monitoring keys
* Push notification credentials

Secrets must never be committed to source control.

---

# Secrets Management

Secrets must be stored using:

* GitHub Secrets for CI/CD
* Secure production secret manager
* EAS Secrets for mobile builds

Never store secrets in:

* Source code
* Logs
* Screenshots
* Documentation
* Plain `.env` files committed to Git

---

# Database Migrations

Database migrations must be:

* Reviewed
* Tested
* Reversible when possible
* Backward compatible
* Executed before dependent code when required

Never edit historical migrations.

Create new migrations instead.

---

# Migration Safety Rules

Before production migration verify:

* Backup completed
* Migration tested in staging
* Rollback strategy defined
* Data integrity verified
* Downtime requirement understood
* Application compatibility validated

Migrations affecting health data require extra review.

---

# Rollback Strategy

Every release must have a rollback plan.

Rollback may include:

* Reverting backend deployment
* Rolling back mobile OTA update
* Disabling feature flags
* Restoring previous environment variables
* Applying database rollback procedure
* Pausing background workers

Rollback must never cause data loss.

---

# Feature Flags

Feature flags should be used for:

* Risky features
* Gradual rollout
* A/B testing
* Experimental AI features
* New synchronization behavior
* New iCoach rules

Feature flags must not become permanent complexity.

Remove obsolete flags.

---

# Monitoring

Production must monitor:

* API availability
* API latency
* Error rate
* Authentication failures
* Synchronization failures
* Database performance
* Worker failures
* Mobile crashes
* OTA update adoption
* Release health

---

# Logging

Production logs must be structured.

Logs must never contain:

* Passwords
* Tokens
* Medical information
* Personal identifiers
* Encryption keys

Use correlation IDs for traceability.

---

# Error Tracking

Use Sentry or equivalent.

Track:

* Backend exceptions
* Mobile crashes
* Unhandled promise rejections
* Failed synchronization
* API errors
* Database errors

Critical errors must trigger alerts.

---

# Health Checks

Backend must expose health checks for:

* API status
* Database connection
* Redis connection
* Worker status
* Storage availability

Health checks must not expose sensitive information.

---

# Backup Strategy

Production PostgreSQL requires:

* Automated backups
* Point-in-time recovery
* Backup retention policy
* Restore testing

Backups must be encrypted.

Backups must be periodically validated.

---

# Disaster Recovery

Disaster recovery plan must include:

* Data restore process
* Service recovery process
* Incident communication
* Recovery time objective
* Recovery point objective

Health-related data requires special protection.

---

# Release Checklist

Before every release verify:

✓ CI passes

✓ Tests pass

✓ TypeScript passes

✓ Lint passes

✓ Formatting passes

✓ Security audit reviewed

✓ Migrations tested

✓ Rollback plan exists

✓ Environment variables verified

✓ Monitoring enabled

✓ Logs reviewed

✓ Store metadata ready

✓ Privacy requirements satisfied

✓ Smoke tests completed

---

# Production Smoke Tests

After deployment verify:

* Backend health check passes
* Authentication works
* User profile loads
* SQLite initializes
* Dashboard loads
* iCoach recommendations generate
* Offline mode works
* Sync queue initializes
* Reconnect synchronization works
* No critical errors in monitoring

---

# Mobile Production Validation

Verify:

* App opens successfully
* Login works
* Navigation works
* Dashboard renders
* Offline mode works
* Push permissions behave correctly
* SecureStore works
* Biometric authentication works if enabled
* No debug information is visible
* App Store / Play Store build matches intended environment

---

# Release Notes

Every release must include:

* Version number
* Release date
* New features
* Bug fixes
* Breaking changes
* Migration notes
* Known issues
* Rollback notes

---

# Hotfix Policy

Hotfixes are allowed only for:

* Security issues
* Data loss
* Production outage
* Critical app crashes
* Broken authentication
* Broken synchronization

Hotfixes must still pass minimum quality gates.

---

# AI Feature Deployment

AI-related features must be deployed behind feature flags.

AI providers must be isolated.

AI must never bypass deterministic iCoach rules.

AI failures must not break the app.

---

# iCoach Rule Deployment

New iCoach rules require:

* Versioning
* Tests
* Documentation
* Safety validation
* Rollback capability
* Historical preservation

Rules must never modify historical recommendations.

---

# Compliance Release Requirements

Before releasing health-related features verify:

* Consent language reviewed
* Privacy policy updated if needed
* Data minimization applied
* Audit logging enabled
* Secure storage verified
* Export/delete requirements considered

---

# Performance Release Gates

Before release verify:

* Startup time acceptable
* Dashboard performance acceptable
* SQLite queries optimized
* Sync does not block UI
* No excessive battery usage
* No major memory leaks

---

# Deployment Anti-Patterns

Never:

* Deploy manually without documentation
* Deploy from unreviewed branches
* Deploy with failing tests
* Commit secrets
* Skip migration testing
* Release without rollback plan
* Expose debug tools in production
* Store sensitive logs
* Run destructive scripts without approval
* Ship OTA updates that require native changes

---

# AI Instructions

Every AI agent working on deployment must prioritize safety, reproducibility, security, and rollback capability.

Never suggest deployment shortcuts that compromise health data, production stability, or security.

When proposing deployment changes, include:

* Risk
* Rollback strategy
* Environment impact
* Testing requirements
* Security considerations
