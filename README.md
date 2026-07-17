# AppFitness

Offline-first fitness and wellness platform for iOS and Android. AppFitness combines medical and physical tracking with a deterministic on-device coaching engine (iCoach) so recommendations stay reproducible, explainable, and usable without a network connection.

> This app assists informed wellness decisions. It does **not** diagnose conditions or replace licensed medical professionals.

---

## Repository layout

| Path | Role |
|------|------|
| [`mobile/`](./mobile) | **Target** React Native + Expo app (primary product) |
| [`api/`](./api) | **Target** NestJS modular monolith (system of record) |
| [`client/`](./client) | Legacy Vite web MVP — read-only reference during migration |
| [`server/`](./server) | Legacy Express MVP — read-only reference during migration |
| [`.ai/`](./.ai) | Architecture, ADRs, coding standards (source of truth) |
| [`docs/`](./docs) | Release, legal, and operational documentation |

New work belongs in `mobile/` and `api/`. Do not extend `client/` or `server/` (see ADR-0013).

---

## Architecture at a glance

- **Clean Architecture + DDD** with feature-first modules
- **Offline-first**: Expo SQLite is the mobile operational store; PostgreSQL is the backend system of record
- **Sync**: incremental, conflict-aware push/pull with idempotent client operations
- **iCoach**: pure, versioned, deterministic rules on device — AI may explain, never override medical restrictions
- **Security**: JWT + RBAC, field encryption for sensitive medical text, least privilege, privacy by design

Details live in [`.ai/01_ARCHITECTURE.md`](./.ai/01_ARCHITECTURE.md) and [`.ai/12_DECISIONS.md`](./.ai/12_DECISIONS.md).

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Mobile | React Native, Expo, TypeScript (strict), Expo Router, Zustand, Expo SQLite |
| Backend | NestJS, TypeScript, PostgreSQL, Prisma, JWT / Argon2, Swagger |
| Testing | Jest, React Native Testing Library, Supertest |

Approved technologies only — see [`.ai/02_TECH_STACK.md`](./.ai/02_TECH_STACK.md).

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)
- Expo-compatible iOS Simulator / Android Emulator (or a device)

### Backend (`api/`)

```bash
cd api
cp .env.example .env   # fill JWT_ACCESS_SECRET, MEDICAL_ENC_KEY, DATABASE_URL
docker compose up -d   # PostgreSQL on host port 5433
npm install
npx prisma migrate dev
npm run start:dev      # http://localhost:3001 — Swagger at /docs
```

More detail: [`api/README.md`](./api/README.md).

### Mobile (`mobile/`)

```bash
cd mobile
npm install
# optional: set EXPO_PUBLIC_API_URL (default http://localhost:3001)
npm start
```

More detail: [`mobile/README.md`](./mobile/README.md).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`.ai/00_PROJECT.md`](./.ai/00_PROJECT.md) | Project constitution and principles |
| [`.ai/01_ARCHITECTURE.md`](./.ai/01_ARCHITECTURE.md) | System architecture |
| [`.ai/05_SECURITY.md`](./.ai/05_SECURITY.md) | Security requirements |
| [`.ai/06_MOBILE.md`](./.ai/06_MOBILE.md) | Mobile conventions |
| [`.ai/07_ICOACH.md`](./.ai/07_ICOACH.md) | Deterministic coaching engine |
| [`.ai/12_DECISIONS.md`](./.ai/12_DECISIONS.md) | Architecture Decision Records |
| [`.ai/13_MIGRATION_ROADMAP.md`](./.ai/13_MIGRATION_ROADMAP.md) | MVP → production migration phases |
| [`docs/`](./docs) | Release readiness, legal, rollback |

AI assistants and contributors should follow root [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) and the relevant prompt under [`.ai/prompts/`](./.ai/prompts/).

---

## Contributing

1. Read [`.ai/00_PROJECT.md`](./.ai/00_PROJECT.md) and [`.ai/12_DECISIONS.md`](./.ai/12_DECISIONS.md).
2. Prefer small, verifiable changes in `mobile/` or `api/` only.
3. Keep business logic out of UI; use repositories for persistence.
4. Never commit secrets, tokens, or plaintext health data.
5. Add or update tests for domain and sync behavior you change.

CI workflows: [`.github/workflows/`](./.github/workflows/) (`api-ci`, `mobile-ci`, `mobile-e2e`).

---

## Security & privacy

AppFitness handles sensitive health-related data. Treat every change as security-relevant:

- No secrets in the repo — use `.env` from `.env.example`
- Do not log medical field values or tokens
- Follow [`.ai/05_SECURITY.md`](./.ai/05_SECURITY.md) and legal docs under [`docs/legal/`](./docs/legal/)

If you discover a vulnerability, report it privately to the maintainers — do not open a public issue with exploit details.

---

## License

Private / unlicensed unless otherwise stated by the project owner.
