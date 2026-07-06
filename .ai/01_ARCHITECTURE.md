# AppFitness Architecture

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official software architecture of AppFitness.

It serves as the single source of truth for every architectural decision made throughout the project.

Every contributor (human or AI) must follow this document before introducing new features, refactoring existing code, or modifying infrastructure.

When conflicts arise, this document takes precedence over implementation details.

---

# Architectural Vision

AppFitness is designed as a production-grade, offline-first, domain-driven mobile platform.

The architecture must support long-term evolution while minimizing technical debt.

The system must remain:

- Modular
- Testable
- Scalable
- Deterministic
- Secure
- Maintainable

---

# High-Level Architecture

The system is composed of four major layers:

Presentation

↓

Application

↓

Domain

↓

Infrastructure

Each layer has a single responsibility.

Dependencies always point inward.

Outer layers depend on inner layers.

Inner layers never depend on outer layers.

---

# Architectural Style

The project adopts:

- Domain-Driven Design (DDD)
- Clean Architecture
- Feature-First Organization
- Modular Monolith
- Repository Pattern
- Dependency Injection
- Offline-First Synchronization
- Event-Driven Updates (Local)
- Future AI Extensibility

---

# Feature-Based Organization

The project is organized by business capability instead of file type.

Example:

features/

authentication/

nutrition/

workout/

progress/

medical/

icoach/

dashboard/

notifications/

profile/

settings/

shared/

Each feature owns:

- UI
- Application
- Domain
- Infrastructure

Business logic must never be shared through UI components.

---

# Layer Responsibilities

## Presentation

Responsibilities

- Screens
- Navigation
- Components
- Hooks
- UI State
- Accessibility

Must NOT contain:

Business rules

Database access

SQL

Networking

Complex calculations

---

## Application

Responsibilities

Use Cases

Commands

Queries

State orchestration

Transactions

Workflow coordination

This layer orchestrates business operations.

It does not contain UI.

---

## Domain

The Domain Layer contains the business itself.

Includes:

Entities

Value Objects

Aggregates

Domain Services

Business Rules

Policies

Specifications

No external frameworks should be required here.

The Domain Layer must remain framework-independent.

---

## Infrastructure

Responsibilities:

SQLite

Backend API

PostgreSQL

Prisma

Storage

Networking

Repositories

Logging

Notifications

Caching

Synchronization

This layer implements interfaces defined by the Domain.

---

# Module Independence

Each feature should behave as an independent module.

Features communicate only through:

Use Cases

Public Interfaces

Events

Never through direct internal imports.

---

# State Architecture

The application contains four different types of state.

## UI State

Temporary

Component-specific

Examples:

Modal open

Selected tab

Search text

---

## Local Persistent State

SQLite

Offline-first

Stores user data.

---

## Derived State

Calculated from existing data.

Never persisted.

Examples:

BMI

Calories

Progress

Weekly summaries

---

## Remote State

Backend data synchronized from PostgreSQL.

Must never block the application.

---

# Offline-First Strategy

SQLite is the operational database.

PostgreSQL is the system of record.

Synchronization is asynchronous.

The application must continue functioning without network connectivity.

The synchronization layer is responsible for consistency.

---

# Synchronization Architecture

Changes flow as follows:

User Action

↓

SQLite

↓

Sync Queue

↓

Background Sync

↓

Backend API

↓

PostgreSQL

Every synchronization must be:

Retryable

Idempotent

Observable

Conflict-aware

---

# Repository Pattern

Every data source must be abstracted.

Example:

NutritionRepository

WorkoutRepository

MedicalRepository

ProgressRepository

The rest of the application never knows where data comes from.

---

# Dependency Rule

Allowed:

Presentation

↓

Application

↓

Domain

Infrastructure implements Domain interfaces.

Forbidden:

Presentation → SQLite

Presentation → SQL

Presentation → Prisma

Presentation → API

Presentation → Business Rules

---

# Event-Driven Updates

The application reacts to local events.

Examples:

Evaluation updated

↓

SQLite updated

↓

Repository emits change

↓

State updated

↓

Dashboard refreshed

↓

iCoach recalculates

↓

Recommendations updated

No manual refresh should be required.

---

# iCoach Architecture

The coaching engine is divided into independent modules.

Evaluation Engine

↓

Calculation Engine

↓

Decision Engine

↓

Recommendation Engine

↓

Presentation

Each module has one responsibility.

---

# AI Integration

The architecture is prepared for AI.

However:

AI is optional.

Business rules remain deterministic.

Future providers may include:

Claude

OpenAI

Gemini

Mistral

DeepSeek

Local LLM

The application communicates through interfaces.

Never directly.

---

# Security Architecture

Authentication

↓

Authorization

↓

Business Rules

↓

Repositories

↓

Persistence

Sensitive data should never bypass security layers.

---

# Error Handling

Errors are classified into:

Validation

Business

Infrastructure

Synchronization

Unexpected

Every error should be typed.

Avoid generic exceptions.

---

# Logging

Application logs should be categorized.

Security

Synchronization

Database

API

Performance

Unexpected Errors

Personally identifiable information must never appear in logs.

---

# Performance Principles

Optimize only after measuring.

Avoid unnecessary renders.

Prefer memoization when justified.

Use lazy loading.

Paginate large datasets.

Batch expensive operations.

Keep animations on the native thread whenever possible.

---

# Scalability

Every new feature should be independently deployable in the future.

The architecture should support extraction into microservices without major refactoring.

This is achieved through strict module boundaries.

---

# Dependency Injection

Every external dependency should be injectable.

Never instantiate infrastructure directly inside business logic.

---

# Configuration

Configuration must be centralized.

Environment variables should never be scattered across the codebase.

Secrets should never be hardcoded.

---

# Shared Module

The shared module contains only:

Utilities

Constants

Reusable UI components

Shared Types

Shared Interfaces

Cross-cutting concerns

It must never contain business rules.

---

# Anti-Patterns

The following are prohibited:

Business logic inside UI

SQL inside screens

Large God Components

Circular dependencies

Hidden side effects

Global mutable state

Duplicated calculations

Magic numbers

Hardcoded configuration

Tight coupling

Framework-dependent domain logic

---

# Architectural Decision Process

Before introducing a new technology, verify:

Does it solve an existing problem?

Does it reduce complexity?

Does it increase maintainability?

Does it align with the existing architecture?

Can the same result be achieved using current tools?

If any answer is "No", reconsider the proposal.

---

# Evolution Strategy

The architecture evolves incrementally.

Large rewrites are discouraged.

New capabilities should extend existing modules.

Breaking architectural changes require documented approval.

---

# AI Instructions

Every AI agent must:

Read this document before proposing architecture.

Respect module boundaries.

Never violate dependency rules.

Never introduce unnecessary abstractions.

Always justify architectural recommendations.

When repository evidence is insufficient, ask for clarification instead of making assumptions.