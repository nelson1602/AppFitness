# AppFitness Mobile Engineering Handbook

Version: 1.1
Status: Active
Last Updated: 2026-08-28

---

# Purpose

This document defines the official mobile engineering standards for AppFitness.

It establishes architectural patterns, engineering practices, performance requirements, and UX principles for every mobile feature.

Every mobile implementation must comply with this document.

---

# Engineering Goals

The mobile application must be:

- Native feeling
- Fast
- Predictable
- Offline-first
- Secure
- Battery efficient
- Accessible
- Highly maintainable
- Scalable

Every decision should improve user experience without sacrificing maintainability.

---

# Mobile Technology

Framework

- React Native

Runtime

- Expo

Language

- TypeScript (Strict)

Navigation

- Expo Router

Database

- Expo SQLite

State

- Zustand

Validation

- Zod

Forms

- React Hook Form

Animations

- React Native Reanimated

Gestures

- React Native Gesture Handler

Icons

- Expo Vector Icons

Secure Storage

- Expo SecureStore

Notifications

- Expo Notifications

Authentication

- Expo Local Authentication

---

# Mobile Architecture

Architecture follows:

Feature First

↓

Clean Architecture

↓

DDD

↓

Repository Pattern

↓

Offline First

Each feature owns:

Presentation

Application

Domain

Infrastructure

Features communicate through public interfaces only.

---

# Folder Structure

features/

authentication/

dashboard/

medical/

nutrition/

workout/

progress/

icoach/

profile/

settings/

notifications/

shared/

Each feature contains:

presentation/

application/

domain/

infrastructure/

tests/

---

# Navigation

Use Expo Router.

Navigation should be:

Predictable

Typed

Lazy Loaded

Protected

Authentication-aware

Deep Link ready

Avoid nested navigation complexity.

---

# Screen Principles

Every screen should:

Have one responsibility.

Remain under 300 lines whenever possible.

Contain minimal logic.

Delegate business operations.

Never access SQLite directly.

Never call APIs directly.

---

# Components

Component hierarchy

Screen

↓

Section

↓

Card

↓

Reusable Component

↓

Primitive

Components should remain:

Reusable

Composable

Small

Accessible

Avoid large "God Components."

---

# Hooks

Hooks encapsulate:

State

Effects

Subscriptions

Synchronization

Permissions

Do not place business rules inside hooks.

---

# State Management

Separate state into:

UI State

Persistent State

Derived State

Remote State

Never duplicate state.

Derived state should be computed.

---

# SQLite Integration

Presentation never queries SQLite directly.

Flow:

UI

↓

Use Case

↓

Repository

↓

SQLite

Repositories own persistence.

Platform scope (ADR-P019): SQLite persistence is native-only. On Web the local
database is dormant/unsupported — the auth path creates no local user, no
sensitive data is persisted in the browser, and DB-backed screens must show an
explicit bilingual "unavailable on Web" state (never crash, never silently
no-op, never fabricate data). Native behavior is unchanged.

---

# Offline First

Offline support is mandatory.

Application must operate normally for at least 48 hours without Internet.

Network availability must never block:

Viewing data

Logging workouts

Logging meals

Medical evaluations

Progress tracking

---

# Synchronization

Changes are stored locally first.

SQLite

↓

Sync Queue

↓

Background Worker

↓

Backend

Synchronization should:

Retry automatically

Resume automatically

Handle conflicts

Avoid duplicate requests

---

# Rendering Strategy

Optimize rendering by:

Splitting components

Memoization when necessary

FlatList virtualization

FlashList for large datasets

Lazy loading

Stable keys

Avoid unnecessary renders.

---

# Performance Targets

Cold Start

<2 seconds

Screen Transition

<300ms

Interaction Response

<100ms

60 FPS minimum

Avoid frame drops.

---

# Memory Management

Avoid memory leaks.

Dispose subscriptions.

Clean timers.

Release listeners.

Cancel async tasks.

Unload unused resources.

---

# Battery Optimization

Avoid unnecessary:

Polling

Location updates

Animations

Background work

Synchronization

Batch expensive operations.

---

# Networking

Only repositories perform networking.

Support:

Retry

Timeout

Cancellation

Caching

Background sync

Offline fallback

---

# Images

Use:

Expo Image

Lazy loading

Caching

Responsive sizing

Compression

Never load oversized assets.

---

# Forms

All forms must use:

React Hook Form

Zod Validation

Immediate validation feedback

Autosave where appropriate

---

# Accessibility

Support:

Screen readers

Large fonts

VoiceOver

TalkBack

Keyboard navigation where applicable

High contrast

Minimum touch target:

44x44

Accessibility is mandatory.

---

# Animations

Use Reanimated.

Animations should:

Support 60 FPS

Avoid blocking JS thread

Be subtle

Improve UX

Never distract users.

---

# Error Handling

Every screen must handle **its applicable subset** of the eight canonical states
fixed by ADR-P022 and defined in `.ai/08_UI_UX.md` §Canonical State Patterns:

Loading

Empty

Data-gap

Error

Offline

Pending sync

Conflict

Web unavailable

**Applicable subset, not all eight.** A screen can enter a canonical state only
where an **authoritative source for that state is exposed to the screen**.
Pending sync requires accessible queued-write state; Offline requires an
authoritative connectivity or sync signal. Neither may be inferred from the
*kind* of surface — establish it from the store, the domain type and the sync
wiring, for that screen, as it stands.

The per-surface bindings — trigger, source state, rendered treatment, exit
condition and platform — are recorded in `.ai/18_SCREEN_STATE_MATRICES.md`, and
a state recorded there as not applicable carries the reason it is not.

**Do not invent a ninth state.** A new tone, message or transient sub-phase is
not a new state. Success confirmations, hydration and session-resolution phases,
write sub-phases, forms and field validation are classified in that document and
are none of the eight.

Never leave users without feedback.

*v1.1 (2026-08-28).* This section previously listed "Loading, Empty, Offline,
Success, Failure, Permission denied, Unexpected errors". **Success** and
**Permission denied** are not canonical states — `.ai/08_UI_UX.md` records both
as future needs with no API, anatomy, variant or placeholder contract, and
permission has zero localization keys and zero handling in the codebase. The list
predated the state model and is replaced by it. No new state was created.

---

# Notifications

Support:

Local notifications

Push notifications

Scheduled reminders

Health reminders

Workout reminders

Nutrition reminders

Notifications must respect user preferences.

---

# Deep Links

Support:

Authentication

Protected routes

External links

Future QR integrations

---

# OTA Updates

Use Expo Updates.

Updates must:

Be backward compatible

Support rollback

Preserve local data

Avoid forced updates whenever possible.

---

# Security

Store:

Tokens

Credentials

Secrets

Only inside SecureStore.

Never expose sensitive information in UI.

Prevent screenshots of sensitive screens where applicable.

---

# Internationalization

Public v1 must support Spanish and English as first-class languages.

Use the supported device locale by default, provide an in-app language selector,
and fall back to English when a translation key is unavailable.

Never hardcode strings.

All user-facing text must be translatable.

Domain calculations and stable rule/catalog identifiers must remain locale-
independent. Translate presentation labels, explanations, validation, errors,
accessibility content, dates, numbers, food names, exercise names, and units.

The existing `medical/` feature is retained as dormant architecture under
ADR-P017. Until a future reactivation ADR is approved, it must not be reachable
from public-v1 navigation/onboarding or registered as a public-v1 write/sync/
iCoach input path.

---

# Theme

Support:

Light Mode

Dark Mode

Future Dynamic Themes

Never hardcode colors.

Use theme tokens.

---

# Design System

Follow Material Design 3.

Use consistent:

Spacing

Typography

Elevation

Color roles

Corner radius

Animations

---

# Component Guidelines

Prefer composition.

Avoid inheritance.

Reusable components belong inside shared.

Business-specific components remain inside their feature.

---

# Testing

Every feature should support:

Unit tests

Component tests

Integration tests

Critical user flows should support E2E.

---

# Anti-Patterns

Never:

Access SQLite inside components

Call APIs inside screens

Duplicate business logic

Store derived state

Create oversized components

Nest excessive navigation

Hardcode colors

Hardcode strings

Ignore accessibility

Block UI during synchronization

---

# Mobile Quality Checklist

Every implementation must verify:

✓ Offline capable

✓ Responsive

✓ Accessible

✓ Secure

✓ Performant

✓ Battery efficient

✓ Type-safe

✓ Tested

✓ Theme compliant

✓ Architecture compliant

✓ Synchronization compatible

✓ Documentation updated

---

# AI Instructions

Every AI agent working on AppFitness mobile must:

Respect Feature-First architecture.

Keep business logic outside UI.

Optimize for offline-first.

Minimize re-renders.

Preserve battery life.

Prefer reusable components.

Never sacrifice maintainability for short-term optimization.

Every mobile implementation should feel indistinguishable from a high-quality native application.
