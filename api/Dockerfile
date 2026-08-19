# AppFitness API — production image (ADR-P009).
#
# Multi-stage: build with dev dependencies, run with production
# dependencies only. No secrets are baked in — all configuration comes
# from environment variables at runtime (see DEPLOYMENT.md).
#
# Debian-slim (glibc) rather than alpine so Prisma tooling needs no
# musl-specific handling.

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Placeholder URL only — prisma generate makes no database connection.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate \
 && npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generated Prisma client (build stage generated it into node_modules).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Compiled app + schema/migrations (needed by the pre-deploy migration
# release step `npm run db:deploy` — see DEPLOYMENT.md).
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./

# Deterministic-migration guard: the pre-deploy step is `npm run db:deploy`
# (= `prisma migrate deploy`), which runs the image-resident, lockfile-pinned
# Prisma CLI with no registry access. `npm ci --omit=dev` already installs
# that CLI because the lockfile resolves `prisma` into the production tree —
# no extra COPY, so the image stays at baseline size. Fail the build now
# (never silently at deploy) if a future lockfile change drops the CLI from
# the production tree. No version is hardcoded; the lockfile stays
# authoritative.
RUN test -e node_modules/prisma/package.json \
 && test -e node_modules/.bin/prisma \
 && node_modules/.bin/prisma --version > /dev/null \
 || ( echo "ERROR: Prisma CLI absent after 'npm ci --omit=dev' — the lockfile no longer resolves 'prisma' into the production dependency tree, so the pre-deploy 'npm run db:deploy' would fail at deploy time. Restore it (e.g. move 'prisma' to dependencies) before shipping." >&2 && exit 1 )

# Run as the non-root user provided by the base image.
USER node

EXPOSE 3001
CMD ["node", "dist/src/main.js"]
