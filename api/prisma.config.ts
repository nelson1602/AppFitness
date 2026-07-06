import { defineConfig } from 'prisma/config';

// Prisma 7 CLI configuration. The datasource URL is read from the
// environment (.env is not committed). No live connection is made by
// `prisma validate` / `prisma generate`; Migrate (which does connect)
// is deferred until live PostgreSQL validation is approved (Phase 3+).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/appfitness_dev',
  },
});
