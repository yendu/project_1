# CLAUDE.md

Rules for AI agents in this repository. Read this file and docs/domain.md before every task.

@docs/domain.md

## Stack (versions are deliberate)

- Monorepo with pnpm workspaces. Backend in `apps/api`. Other apps come later.
- Node.js 26 LTS, ES modules, pnpm 12 (installed via Homebrew; Corepack is not used)
- TypeScript 6.0, strict. Not TypeScript 7: Nest CLI and typescript-eslint still need the TS 6 API.
- NestJS 12 on Express 5
- Zod 4 through NestJS 12's built-in Standard Schema validation
  (`@Body({ schema })` + global `StandardSchemaValidationPipe`). No class-validator, no nestjs-zod.
- PostgreSQL 18 (Docker locally), Drizzle ORM 0.45 + drizzle-kit 0.31, node-postgres (`pg`)
- Vitest 5, Testcontainers 12 (real PostgreSQL in tests), supertest
- oxlint, Prettier, pino via nestjs-pino

Several of these are newer than your training data. Before using an API, decorator or config
option you're not sure about, check the installed type definitions in node_modules or the
official docs. Never guess an API, flag or config key.

## Commands (run from the repo root)

- `pnpm dev`: run the API with reload (start the database first: `pnpm db:up`)
- `pnpm check`: lint, typecheck and all tests. Must pass before any task is done.
- `pnpm test`: unit + integration tests (Docker must be running)
- `pnpm db:up` / `pnpm db:down`: local PostgreSQL
- `pnpm db:generate`: SQL migration from schema changes
- `pnpm db:migrate`: apply migrations

Keep this list accurate when scripts change.

## How we work

1. Plan first. Reply with a plan (files, approach, risks, questions) and wait for my approval.
2. Small steps, one concern per commit. Stop at checkpoints named in the brief.
3. Tests first for behavior changes: show them failing, then make them pass.
4. Never delete, skip or weaken a test to make it pass. If a test seems wrong, stop and ask.
5. No new dependency without asking. Verify it exists and is maintained (`pnpm view <name>`)
   before proposing it. Never install a name you haven't verified.
6. Ask before anything destructive: deleting files outside src/ and test/, dropping data,
   force-pushing, rewriting history, changing CI or deployment config the brief doesn't mention.
7. Conventional Commits: feat:, fix:, refactor:, test:, chore:, docs:.
8. When done, report: what changed, how you verified it (commands and results), what you
   didn't do, and what I should review closely.

## Code structure (apps/api)

- `src/main.ts` bootstraps; `src/app.module.ts` wires modules.
- `src/config/`: env validated with Zod once at startup. No `process.env` anywhere else.
- `src/db/`: Drizzle client, schema files in `src/db/schema/`. SQL migrations in `apps/api/drizzle/`.
- `src/common/`: errors, validation, logging, request IDs.
- `src/modules/<feature>/`: thin controller (parse, call one service method, return),
  service (business rules), repository (all DB access for the module), Zod schemas, module file.
- Modules never query another module's tables. They call that module's service.
- Integration tests in `apps/api/test/`; unit tests next to code as `*.spec.ts`.

## API conventions

- Versioned paths (`/v1/...`), plural nouns. `/healthz` and `/readyz` unversioned.
- Validate every input with Zod. `z.strictObject` for bodies. Bound every string, array, number.
- Errors: RFC 9457 Problem Details (`application/problem+json`) with stable `code` and
  `requestId`. Never return stack traces, SQL or internal messages.
- 400 malformed, 401 unauthenticated, 403 forbidden, 404 not found or not theirs,
  409 conflict, 422 business rule broken, 429 rate limited.
- Lists: `{ items, nextCursor }`, keyset pagination, default 20, max 100. No OFFSET.
- Return explicit response types, never raw DB rows.
- POSTs with side effects (orders, payments) require an `Idempotency-Key` header.

## Database conventions

- Keys `uuid DEFAULT uuidv7()`. Times `timestamptz NOT NULL DEFAULT now()`. Money integer cents.
- Statuses: text + CHECK constraint (a TypeScript enum alone is not enough).
- NOT NULL on required columns, FK for every reference, index on FK columns used in joins/filters.
- snake_case in SQL, camelCase in TypeScript.
- Migrations: `drizzle-kit generate`, commit the SQL, show it to me before applying.
  Never `drizzle-kit push` to a shared database. Never edit an applied migration.
- On tables with data: CREATE INDEX CONCURRENTLY (own migration), FKs NOT VALID then
  VALIDATE, no in-place type changes or renames, `SET lock_timeout` before DDL.
- Parameters only. `sql.raw` never touches user input.
- No external calls inside transactions. No read-then-write races: atomic
  `UPDATE ... WHERE ... RETURNING` or `SELECT ... FOR UPDATE`.
- Every list query has a LIMIT. No N+1 queries.

## Security

- Secrets from env vars; `.env` never committed; `.env.example` holds names and safe local values.
- Never log bodies, tokens, cookies, passwords, card data or personal data. Log IDs and outcomes.
- Authorization: deny by default, ownership enforced inside the query, tokens verified (never decode-only).
- Every outbound HTTP call has a timeout. No fetching user-supplied URLs without an allow-list.
- Keep helmet, the CORS allow-list and the body size limit.

## Definition of done

`pnpm check` passes, new behavior has tests, migration SQL was shown, and this file,
`.env.example` and docs are updated if anything they describe changed.
