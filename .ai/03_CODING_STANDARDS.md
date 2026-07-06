# AppFitness Coding Standards

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official engineering standards for AppFitness.

Every contributor (human or AI) must follow these standards to ensure consistency, maintainability, scalability, readability, and long-term sustainability.

If implementation conflicts with this document, this document takes precedence unless superseded by an approved ADR.

---

# General Principles

Always prioritize:

- Readability
- Simplicity
- Maintainability
- Predictability
- Testability
- Security
- Performance

Code is read more often than it is written.

Optimize for future maintainers.

---

# Clean Code

Code should be:

- Small
- Cohesive
- Explicit
- Predictable
- Self-documenting

Avoid unnecessary abstractions.

Avoid premature optimization.

Prefer clarity over cleverness.

---

# SOLID

Every feature must follow SOLID principles.

Single Responsibility Principle

Open/Closed Principle

Liskov Substitution Principle

Interface Segregation Principle

Dependency Inversion Principle

---

# DRY

Avoid duplicated business logic.

Shared logic belongs in reusable modules.

Never copy and paste implementations.

---

# KISS

Choose the simplest solution that satisfies the requirements.

Avoid unnecessary complexity.

---

# YAGNI

Do not implement features before they are needed.

Prepare for extension without implementing speculative functionality.

---

# TypeScript

Strict Mode is mandatory.

Forbidden:

- any
- @ts-ignore
- implicit any
- non-null assertions unless justified

Prefer:

- interfaces
- type inference
- discriminated unions
- readonly
- utility types

---

# Naming Conventions

Variables

camelCase

Functions

camelCase

Constants

UPPER_SNAKE_CASE

Classes

PascalCase

Interfaces

PascalCase

Types

PascalCase

Enums

PascalCase

Files

kebab-case

Folders

kebab-case

React Components

PascalCase

Hooks

useSomething

Contexts

SomethingContext

Providers

SomethingProvider

Repositories

SomethingRepository

Services

SomethingService

DTOs

SomethingDto

Entities

Something

---

# File Organization

One primary responsibility per file.

Avoid files exceeding 300 lines whenever possible.

Split large components.

Large functions should be extracted.

---

# Function Standards

Functions should:

- perform one responsibility
- be deterministic
- avoid side effects
- return early
- remain concise

Avoid deeply nested logic.

Maximum nesting:

3 levels.

---

# Components

React components should:

- remain presentational whenever possible
- receive explicit props
- avoid embedded business logic
- avoid SQL
- avoid API logic

Business logic belongs elsewhere.

---

# Hooks

Custom hooks should encapsulate:

- reusable logic
- side effects
- subscriptions
- synchronization

Hooks should never become mini-services.

---

# State Management

Separate:

UI State

Persistent State

Remote State

Derived State

Never duplicate state.

Derived data should not be stored.

---

# Business Logic

Business rules belong exclusively inside:

- Domain
- Application

Never inside:

- Screens
- Components
- Hooks
- Navigation

---

# Error Handling

Never ignore errors.

Never swallow exceptions.

Every error should be:

- typed
- logged
- actionable

Use custom error classes.

Avoid generic Error.

---

# Logging

Logs should provide value.

Never log:

Passwords

Tokens

Medical records

Personal identifiers

Sensitive data

Log levels:

Debug

Info

Warning

Error

Critical

---

# Async Code

Prefer:

async/await

Avoid:

Long Promise chains

Nested callbacks

Unhandled promises

Always handle failures.

---

# Database

Never write raw SQL inside UI.

Repositories own persistence.

Use transactions when appropriate.

Preserve data integrity.

---

# API

Controllers should:

Validate input

Delegate work

Return responses

Nothing else.

Business logic belongs elsewhere.

---

# Validation

Validate:

Input

Output

Database

External APIs

Never trust user input.

---

# Security

Sanitize inputs.

Escape outputs.

Validate permissions.

Protect secrets.

Never hardcode:

Keys

Passwords

URLs

Tokens

Certificates

---

# Performance

Measure before optimizing.

Avoid unnecessary renders.

Memoize only when beneficial.

Lazy load expensive resources.

Batch database operations.

Avoid unnecessary allocations.

---

# Accessibility

Support:

Screen readers

Large text

Dark mode

Touch targets

Keyboard navigation where applicable

Accessibility is mandatory.

---

# Documentation

Public APIs must be documented.

Complex business rules require documentation.

Architectural changes require ADR updates.

---

# Imports

Prefer absolute imports.

Avoid circular dependencies.

Group imports:

Standard library

Third-party

Internal

Relative

Sort alphabetically.

---

# Dependencies

Before adding a dependency verify:

- Is it actively maintained?
- Is it secure?
- Is it necessary?
- Does it duplicate existing functionality?
- Is bundle size acceptable?

Prefer existing project libraries.

---

# Git

Branches

feature/

fix/

refactor/

hotfix/

docs/

test/

Conventional Commits are mandatory.

Examples:

feat:

fix:

refactor:

docs:

test:

chore:

perf:

build:

ci:

---

# Pull Requests

Every PR should:

Solve one problem

Remain focused

Pass tests

Pass lint

Pass formatting

Update documentation if needed

Avoid unrelated changes.

---

# Testing

Every new feature should be testable.

Critical business logic requires unit tests.

Regression tests should accompany bug fixes.

---

# Refactoring

Refactor incrementally.

Avoid massive rewrites.

Preserve behavior.

Document architectural changes.

---

# Code Review Checklist

Before considering work complete verify:

✓ No duplicated logic

✓ No unnecessary complexity

✓ No lint errors

✓ No TypeScript errors

✓ No dead code

✓ No unused imports

✓ No circular dependencies

✓ Tests pass

✓ Documentation updated

✓ Architecture respected

---

# AI Instructions

Every AI agent must:

Follow these standards by default.

Never introduce inconsistent naming.

Never bypass architecture.

Never duplicate logic.

Never ignore existing patterns.

When multiple implementations are possible, choose the one that best aligns with this document.