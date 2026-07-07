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

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generated Prisma client (build stage generated it into node_modules).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Compiled app + schema/migrations (needed by the pre-deploy
# `npx prisma migrate deploy` release step — see DEPLOYMENT.md).
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./

# Run as the non-root user provided by the base image.
USER node

EXPOSE 3001
CMD ["node", "dist/main.js"]
