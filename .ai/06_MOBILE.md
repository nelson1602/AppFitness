# AppFitness Mobile Engineering Handbook

Version: 1.0
Status: Active
Last Updated: 2026-07-03

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

Every screen should handle:

Loading

Empty

Offline

Success

Failure

Permission denied

Unexpected errors

Never leave users without feedback.

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

Support multiple languages.

Never hardcode strings.

All user-facing text must be translatable.

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