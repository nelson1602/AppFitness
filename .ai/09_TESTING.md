# AppFitness Quality Engineering Handbook

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official testing and quality engineering strategy for AppFitness.

Every feature, refactor, bug fix, and architectural change must comply with this handbook.

Quality is not optional.

---

# Quality Philosophy

AppFitness handles sensitive health-related data.

Therefore, every implementation must prioritize:

- Correctness
- Reliability
- Security
- Accessibility
- Data integrity
- Offline reliability
- Regression prevention
- Deterministic behavior

A feature is not complete until it is tested.

---

# Testing Principles

Tests must be:

- Deterministic
- Fast
- Isolated
- Repeatable
- Meaningful
- Maintainable
- Easy to understand

Avoid tests that only verify implementation details.

Test behavior, not internal structure.

---

# Testing Pyramid

The project follows the testing pyramid:

Unit Tests

↓

Integration Tests

↓

End-to-End Tests

↓

Manual Exploratory Testing

Most tests should be unit tests.

Fewer tests should be E2E tests.

E2E tests must focus on critical user journeys.

---

# Required Test Types

AppFitness requires:

- Unit Tests
- Integration Tests
- Component Tests
- End-to-End Tests
- API Tests
- Database Tests
- Synchronization Tests
- Offline Tests
- Security Tests
- Accessibility Tests
- Performance Tests
- Regression Tests

---

# Unit Testing

Unit tests validate isolated business logic.

Required for:

- iCoach rules
- Nutrition calculations
- Workout calculations
- Validation logic
- Domain services
- Utility functions
- Synchronization helpers
- Conflict resolution logic

Unit tests must not depend on:

- Network
- Real databases
- UI rendering
- External APIs

---

# Integration Testing

Integration tests validate interaction between modules.

Required for:

- Repositories
- Use cases
- SQLite access
- Backend API modules
- Prisma services
- Authentication flows
- Synchronization flows

Integration tests should use controlled test data.

---

# Component Testing

Component tests validate UI behavior.

Required for:

- Forms
- Dashboard cards
- iCoach insight banners
- Navigation states
- Error states
- Empty states
- Loading states

Use React Native Testing Library.

Test user-visible behavior.

Avoid testing internal implementation details.

---

# End-to-End Testing

E2E tests validate real user workflows.

Required flows:

- User registration
- Login
- Profile setup
- Medical evaluation entry
- Physical evaluation entry
- Nutrition plan generation
- Workout plan generation
- Offline data entry
- Synchronization after reconnecting
- Dashboard refresh
- Logout

Use Detox for mobile E2E testing.

---

# API Testing

Backend APIs must verify:

- Authentication
- Authorization
- Validation
- Error responses
- Rate limiting
- Data integrity
- Pagination
- Filtering
- Synchronization endpoints

Use Supertest or Bruno where appropriate.

---

# Database Testing

Database tests must validate:

- Migrations
- Schema constraints
- Foreign keys
- Indexes
- Transactions
- Soft deletes
- Audit logs
- Synchronization metadata
- Conflict states

Never assume schema correctness without testing.

---

# Offline Testing

Offline-first behavior must be tested explicitly.

Scenarios:

- App starts offline
- User logs meals offline
- User logs workouts offline
- User updates evaluations offline
- iCoach recalculates offline
- Sync queue stores pending changes
- App reconnects
- Pending changes synchronize
- Conflicts are detected
- Failed sync retries safely

The app must remain usable for at least 48 hours offline.

---

# Synchronization Testing

Synchronization tests must validate:

- Queue creation
- Retry policy
- Idempotency
- Conflict detection
- Conflict resolution
- Partial failures
- Duplicate prevention
- Version mismatch handling
- Network failure recovery

Synchronization must never silently lose data.

---

# iCoach Testing

The iCoach Engine requires strict deterministic testing.

Every rule must have tests for:

- Normal case
- Edge case
- Invalid input
- Boundary values
- Medical restriction override
- Goal-specific behavior
- Historical data preservation

Identical inputs must always produce identical outputs.

---

# Security Testing

Security tests must validate:

- Authentication
- Authorization
- Input validation
- Token handling
- Refresh token rotation
- Protected routes
- Sensitive data exposure
- Error message leakage
- Rate limiting
- Secure storage behavior

Never expose sensitive information during test failures.

---

# Accessibility Testing

Every critical screen must validate:

- Screen reader labels
- Touch target size
- Contrast
- Dynamic text
- Reduced motion
- Focus order
- Error announcement
- Form accessibility

Accessibility is a release requirement.

---

# Performance Testing

Performance checks must cover:

- Startup time
- Screen transitions
- Dashboard rendering
- Large lists
- SQLite queries
- Synchronization batches
- Memory usage
- Battery impact

Performance issues should be measured before optimization.

---

# Regression Testing

Every bug fix must include a regression test.

The test must fail before the fix and pass after the fix.

Never fix critical bugs without preventing recurrence.

---

# Test Data

Test data must be:

- Deterministic
- Realistic
- Safe
- Non-sensitive
- Easy to reset

Never use real user health data in tests.

---

# Mocking Policy

Mock external boundaries.

Allowed mocks:

- Network
- External APIs
- Push notifications
- Device sensors
- Secure storage
- AI providers

Avoid mocking domain logic.

Business rules should be tested directly.

---

# Coverage Expectations

Minimum expectations:

Domain Logic

90%+

iCoach Engine

95%+

Synchronization

90%+

Security-Critical Logic

95%+

UI Components

70%+

Coverage is a guide, not the goal.

Meaningful tests matter more than raw numbers.

---

# Quality Gates

Before merging code:

✓ TypeScript passes

✓ Lint passes

✓ Formatting passes

✓ Unit tests pass

✓ Integration tests pass

✓ Critical E2E tests pass

✓ No sensitive data in logs

✓ No skipped tests without justification

✓ Documentation updated when required

✓ ADR updated when architecture changes

---

# Definition of Done

A task is complete only when:

- Code is implemented
- Tests are added or updated
- Existing tests pass
- TypeScript passes
- Lint passes
- Formatting passes
- Security impact reviewed
- Offline impact reviewed
- Documentation updated
- No regressions introduced

---

# CI/CD Testing Strategy

CI must run:

- Type check
- Lint
- Format check
- Unit tests
- Integration tests
- Build verification

Release pipelines must additionally run:

- E2E tests
- Security checks
- Dependency audit
- Smoke tests

---

# Smoke Tests

Before release verify:

- App opens
- Login works
- Dashboard loads
- SQLite initializes
- Offline mode works
- Sync queue initializes
- Backend health check passes
- No critical runtime errors

---

# Manual QA

Manual QA should focus on:

- Usability
- Visual polish
- Accessibility
- Edge cases
- Device-specific behavior
- Offline/online transitions
- App lifecycle behavior

Manual QA does not replace automated testing.

---

# Bug Severity

Critical

Data loss, security issue, app unusable.

High

Core feature broken.

Medium

Feature partially broken.

Low

Minor visual or usability issue.

Critical and High bugs block release.

---

# Anti-Patterns

Never:

Write tests only for coverage

Skip failing tests

Mock everything

Test implementation details unnecessarily

Use real medical data

Ignore flaky tests

Ship without testing offline behavior

Ship without regression tests for bug fixes

Disable quality gates

---

# Testing Checklist

Every new feature must verify:

✓ Unit tests

✓ Integration tests where needed

✓ Component tests where needed

✓ E2E coverage for critical flow

✓ Offline behavior

✓ Sync behavior

✓ Accessibility

✓ Error states

✓ Empty states

✓ Security impact

✓ Performance impact

✓ Regression risk

---

# AI Instructions

Every AI agent working on AppFitness must treat testing as mandatory.

Never mark work complete without considering tests.

Never remove tests unless they are obsolete and replaced.

When implementing business logic, generate meaningful test cases.

When fixing bugs, add regression tests.

When modifying iCoach, verify deterministic behavior.