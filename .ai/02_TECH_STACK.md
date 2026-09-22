# AppFitness Technology Stack

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official technology stack for AppFitness.

Only technologies documented here should be used unless an Architecture Decision Record (ADR) explicitly approves an alternative.

The primary goals are:

- Stability
- Maintainability
- Performance
- Scalability
- Security
- Developer Experience

---

# Frontend

## Mobile

Framework

- React Native
- Expo (Latest Stable)

Language

- TypeScript (Strict Mode)

Navigation

- Expo Router

State Management

- Zustand

Forms

- React Hook Form

Validation

- Zod

Animations

- React Native Reanimated
- React Native Gesture Handler

UI Components

- React Native Paper
- ~~Expo Vector Icons~~ — **corrected 2026-09-22 (ADR-P033).** This entry was
  wrong twice over: `@expo/vector-icons` is **not a dependency of this project**
  (absent from `mobile/package.json` and from the installed tree), Expo's current
  documentation states it "will be deprecated and is not recommended", and it
  ships Ionicons / FontAwesome / Glyphicons rather than **Material Symbols**, the
  approved family. ADR-P022 Decision 9 required this reconciliation in the
  icon-delivery slice; it must not be treated as the selected mechanism.
  **No icon runtime is accepted yet** — see ADR-P033 (Proposed) and §Design
  System → Icons below. A feasibility pilot built on 2026-09-22 renders three
  dashboard icons from two vendored Apache-2.0 Material Symbols faces, with **no
  npm dependency added**; it does not settle the decision.

Charts

- Victory Native XL

Images

- Expo Image

Localization

- i18next

Notifications

- Expo Notifications

Deep Linking

- Expo Router

Secure Storage

- Expo SecureStore

Biometrics

- Expo Local Authentication

---

# Backend

Framework

- NestJS

Language

- TypeScript

API

- REST

Future Support

- GraphQL (Optional)

Authentication

- JWT
- Refresh Tokens

Authorization

- Role-Based Access Control (RBAC)

Validation

- class-validator

Documentation

- Swagger OpenAPI

Background Jobs

- BullMQ

Cache

- Redis

Transactional Email (ADR-P026)

- Postmark — approved provider, reached over its **REST API** only

Consumed exclusively through a provider-agnostic `MailTransport` port, so the
vendor is replaceable without touching call sites. **No vendor SDK is required
or approved**; the REST call is made with the platform `fetch`. A
`FakeMailTransport` is the only transport bound in tests and CI.

**Resend** is a recorded, evaluated **fallback only**. Adopting it requires its
own decision — naming it here does not approve it.

Out of scope of this entry: marketing email, scheduled reports, digests,
preference centres, and any queue or scheduler. BullMQ and Redis remain approved
but **unbuilt**, and ADR-P026 does not introduce them.

Logging

- Pino

File Upload

- S3 Compatible Storage

---

# Database

Mobile

- Expo SQLite

Server

- PostgreSQL

ORM

- Prisma

Migration Tool

- Prisma Migrate

Synchronization

- Repository Pattern
- Sync Queue
- Background Sync

---

# AI Architecture

Current

- Deterministic Rule Engine

Future

- Claude
- OpenAI
- Gemini
- Local Models

All AI providers must implement a common interface.

AI never replaces deterministic calculations.

---

# Security

Authentication

- JWT

Session

- Refresh Token Rotation

Storage

- Expo SecureStore

Encryption

- AES-256
- TLS 1.3

Password Hashing

- Argon2

API Security

- Helmet
- Rate Limiting
- CORS

Compliance

- HIPAA Principles
- GDPR Principles
- OWASP Mobile

---

# Testing

Unit Testing

- Jest

Integration Testing

- Supertest

Component Testing

- React Native Testing Library

E2E

- Detox

API Testing

- Bruno

Performance

- React DevTools
- Flipper

---

# Code Quality

Formatting

- Prettier

Linting

- ESLint

Git Hooks

- Husky

Commit Standards

- Commitlint
- Conventional Commits

Static Analysis

- TypeScript Strict Mode

---

# DevOps

Containerization

- Docker

Container Orchestration

- Docker Compose

Reverse Proxy

- Nginx

CI/CD

- GitHub Actions

Secrets

- GitHub Secrets

Monitoring

- Sentry

Analytics

- PostHog

---

# Mobile Build

Development

- Expo Development Build

Production

- Expo EAS Build

OTA Updates

- Expo Updates

---

# Storage

Local

- SQLite

Secure

- SecureStore

Remote

- PostgreSQL

Files

- S3 Compatible Storage

---

# Networking

Protocol

- HTTPS Only

API

- REST

Data Format

- JSON

Compression

- Gzip

Future

- HTTP/2

---

# Synchronization Strategy

Architecture

Offline First

Primary Source

SQLite

System of Record

PostgreSQL

Sync Method

Queued Background Synchronization

Conflict Resolution

Last Writer Wins only for non-critical fields.

Critical health information requires explicit conflict resolution.

---

# Design System

Design Language

- Material Design 3

Theme

- Light
- Dark
- Dynamic Themes (Future)

Icons

- Material Symbols — the approved **visual family** (ADR-P022 Decision 9).
  Its **React Native delivery mechanism is not settled**: no *installed* package
  renders Material Symbols on **iOS** (`expo-symbols` accepts only SF Symbols
  there, and its Material image source is an explicit no-op on iOS), and the
  shipped `@expo-google-fonts/material-symbols` faces are **static** (no
  `fvar`), carry no `FILL` axis and include no filled face, so Decision 9's
  "filled when selected" cannot be expressed from them at all.
- **Vendored Material Symbols faces — feasibility pilot, 2026-09-22.** Two
  Apache-2.0 static instances, `Material Symbols Outlined` (`FILL=0`) and
  `Material Symbols Outlined Filled` (`FILL=1`), live in
  `mobile/assets/fonts` and are linked into native builds by the **`expo-font`
  config plugin** (already a dependency) and loaded from those same files on Web.
  Icons render as **ligatures**, so no private glyph table is imported and **no
  npm dependency was added**. Both files ship with the Apache-2.0 `LICENSE` and
  a `NOTICE.md` recording provenance and SHA-256.
- **Cost:** 2,409,920 B of unsubsetted font assets — the figure a Web client
  fetches. A same-profile EAS comparison measured the Android APK impact at
  **+988,820 B** (`117,304,493` B baseline → `118,293,313` B pilot), closely
  matching the prior 996,237 B deflate estimate. Because the faces
  arrive through a config plugin, adding or changing one needs a **native
  rebuild** and cannot ship OTA. See **ADR-P033 (Proposed)** — **Web rendering is
  verified in a real browser**, an Android APK now builds and contains both
  source-identical faces, but **Android device rendering and all iOS rendering
  remain unverified**, so this is not yet the accepted icon system.

Typography

- Inter

Spacing

- 8px Grid System

---

# Supported Platforms

Primary

- Android

- iOS

Future

- Web Dashboard

- Admin Portal

---

# Versioning

Source Control

- Git

Branch Strategy

- GitHub Flow

Semantic Versioning

- SemVer

Release Strategy

- Continuous Delivery

---

# Dependency Policy

New dependencies require evaluation based on:

- Stability
- Maintenance
- Community Support
- Security
- Bundle Size
- Performance
- Documentation
- Enterprise Adoption

Dependencies that duplicate existing functionality should not be added.

---

# Deprecation Policy

Technologies may only be replaced through an approved ADR.

Backward compatibility should be preserved whenever technically feasible.

---

# AI Instructions

Every AI agent must verify this document before recommending libraries, frameworks, or tooling.

Do not introduce technologies outside this document unless explicitly approved through an Architecture Decision Record (ADR).
