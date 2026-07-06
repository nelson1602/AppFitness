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
- Expo Vector Icons

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

- Material Symbols

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