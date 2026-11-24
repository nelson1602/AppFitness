# AppFitness API + staff backoffice SPA — image built from the REPO ROOT
# (ADR-P049). Use it for a Railway service whose root directory is the repo
# root with Dockerfile path `Dockerfile`; the existing `api/Dockerfile` (root
# directory `api/`) is unchanged and still builds the API alone.
#
# Same API steps as api/Dockerfile (keep the two in step), plus one stage that
# builds `admin/` and copies its `dist` to /admin/dist, the path the API serves
# at /admin by default (working directory /app → ../admin/dist). The SPA is
# only served when the ADMIN_* secrets are set; without them /admin/api
# answers 503 and /admin is not mounted. No secrets are baked in.

# ─── Admin SPA build ─────────────────────────────────────────────────────────
FROM node:24-slim AS admin
WORKDIR /admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

# ─── API build stage ─────────────────────────────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY api/package.json api/package-lock.json ./
RUN npm ci

COPY api/prisma ./prisma
COPY api/prisma.config.ts api/tsconfig.json api/tsconfig.build.json api/nest-cli.json ./
COPY api/src ./src

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

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Compiled app + schema/migrations (pre-deploy `npm run db:deploy`).
COPY --from=build /app/dist ./dist
COPY api/prisma ./prisma
COPY api/prisma.config.ts ./

# The built SPA (static files only; read-only for the runtime user).
COPY --from=admin /admin/dist /admin/dist

# Same deterministic-migration guard as api/Dockerfile.
RUN test -e node_modules/prisma/package.json \
 && test -e node_modules/.bin/prisma \
 && node_modules/.bin/prisma --version > /dev/null \
 || ( echo "ERROR: Prisma CLI absent after 'npm ci --omit=dev' — see api/Dockerfile." >&2 && exit 1 )

USER node

EXPOSE 3001
CMD ["node", "dist/src/main.js"]
