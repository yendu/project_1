# Phase 2: Database foundation

## Goal

Give the API a PostgreSQL 18 database it can rely on (locally, in tests and in the app) before the
first domain module arrives. No domain tables, no new endpoints for clients.

## Scope

1. **Local PostgreSQL.** `docker-compose.yml` at the repo root runs `postgres:18.6-alpine`,
   bound to `127.0.0.1:5432` only, with a named volume and a `pg_isready` healthcheck.
   `pnpm db:up` starts it and waits until it is healthy; `pnpm db:down` stops it and keeps the data.
2. **Config.** `DATABASE_URL` is required in every environment and must be a `postgres://` or
   `postgresql://` URL. `DATABASE_POOL_MAX` defaults to 10. Startup errors name the variable and
   never echo the value, which contains a password.
3. **Database module.** A global module provides one `pg` pool and one Drizzle client
   (`casing: 'snake_case'`). The pool has a connect timeout and a statement timeout, logs idle-client
   errors instead of crashing the process, and closes on shutdown. The pool connects lazily, so the
   app starts while the database is down and `/readyz` reports it.
4. **Migrations.** `drizzle.config.ts`, schema files in `src/db/schema/`, SQL in `apps/api/drizzle/`.
   `pnpm db:generate` and `pnpm db:migrate` load `apps/api/.env` the way `pnpm dev` does. The first
   migration is an empty baseline, so the generate → commit → migrate path runs for real from day
   one.
5. **Readiness.** `GET /readyz` (unversioned) runs `select 1` with a 2 s limit: 200 `{"status":"ok"}`,
   otherwise 503 `service_unavailable` Problem Details with no database detail. Not access-logged.
6. **Safe database error logs.** Drizzle puts query parameters into its error message, and
   PostgreSQL puts row values into `message`, `detail` and `where`. Logged database errors keep the
   SQL text (placeholders only), SQLSTATE, constraint, table, column and stack frames, and drop the
   rest.
7. **Tests against real PostgreSQL.** A Vitest global setup starts one Testcontainers PostgreSQL
   with the same image as Compose, applies the migrations with Drizzle's migrator, and hands the
   URL to `createTestApp()`.

## Out of scope

Domain tables, per-test-file database isolation (phase 3, when tests first write rows), a
production migration runner and CI (phase 5), seed data, `Idempotency-Key`.

## Known issue to decide before the first table with data

Drizzle 0.45's migrator applies all pending migrations inside one transaction (checked in
`drizzle-orm@0.45.4/pg-core/dialect.js`). `CREATE INDEX CONCURRENTLY` cannot run in a transaction,
so the CLAUDE.md rule for indexes on tables with data needs another path. Not needed in this phase.

## Acceptance

- `pnpm check` passes with Docker running. Every scope item has tests through HTTP or against the
  real database.
- A test proves PostgreSQL is 18 and `uuidv7()` works.
- A test proves `/readyz` returns 503 Problem Details when the database is unreachable.
- A test captures real log output from a failing query and proves the parameter value never
  appears in it.
- The baseline migration SQL is shown before it is applied.
- CLAUDE.md, `.env.example` and this brief are updated where they describe changed behavior.

## Checkpoints

1. After the baseline migration is generated: show the SQL, wait before applying it locally.
2. Done: full report per CLAUDE.md.
