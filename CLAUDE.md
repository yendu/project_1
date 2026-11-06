# CLAUDE.md

Rules for AI agents in this repository. Read this file and docs/domain.md before every task.

@docs/domain.md

For any client UI work, also read docs/design.md.

## Stack (versions are deliberate)

- Monorepo with pnpm workspaces. Backend in `apps/api`. Other apps come later.
- Node.js 26 LTS, ES modules, pnpm 12 (installed via Homebrew; Corepack is not used).
  A new package with an install script fails `pnpm add` until `pnpm-workspace.yaml` lists it under
  `allowBuilds`. Deny it (`pnpm approve-builds '!<name>'`) unless the package fails without it.
- TypeScript 6.0, strict. Not TypeScript 7: @nestjs/cli 12 depends on `typescript ~6.0`.
  npm's `latest` tag is 7.x, so always install with an explicit `~6.0` range.
- NestJS 12 on Express 5
- Zod 4 through NestJS 12's built-in Standard Schema validation
  (`@Body({ schema })` + global `StandardSchemaValidationPipe`). No class-validator, no nestjs-zod.
- PostgreSQL 18 (Docker locally), Drizzle ORM 0.45 + drizzle-kit 0.31, node-postgres (`pg`)
- Vitest 5 with Vite 8 (a required peer). Vite's Oxc transform emits the decorator metadata
  Nest DI needs (`oxc.decorator` in `vitest.config.ts`); no SWC.
- Firebase Auth for Google sign-in. `firebase-admin` only checks tokens, which needs the project
  ID and no service account key.
- Testcontainers 12 (real PostgreSQL in tests), supertest
- oxlint, Prettier, pino via nestjs-pino

Several of these are newer than your training data. Before using an API, decorator or config
option you're not sure about, check the installed type definitions in node_modules or the
official docs. Never guess an API, flag or config key.

## Commands (run from the repo root)

- `pnpm dev`: run the API with reload. Needs `pnpm db:up`, `DATABASE_URL` and
  `FIREBASE_PROJECT_ID`: copy `apps/api/.env.example` to `apps/api/.env`, which is loaded if present.
  Don't switch to `nest start --env-file`: Node itself exits when that file is missing.
- `pnpm check`: lint, typecheck and all tests. Must pass before any task is done.
- `pnpm lint`: oxlint + `prettier --check`. `pnpm format` rewrites files with Prettier.
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm test`: unit + integration tests. Needs Docker running; it starts its own PostgreSQL.
- `pnpm build`: compile the API to `apps/api/dist`
- `pnpm db:up` / `pnpm db:down`: start local PostgreSQL and wait until it's healthy / stop it.
  `db:down` keeps the data.
- `pnpm db:generate`: SQL migration from schema changes. Add `--custom --name=<name>` for an
  empty one to write by hand. Reads the same settings as the app, so it needs a complete `.env`.
- `pnpm db:migrate`: apply migrations to `DATABASE_URL`. Also needs a complete `.env`.

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

## Branches

- `develop` is the working branch. Commit there.
- `main` only moves by merging `develop` into it, and only when I ask. Never commit to `main` directly.
- Push only when I ask.

## Code structure (apps/api)

- `src/main.ts` bootstraps; `src/app.module.ts` wires modules (`AppModule.register(env)`).
- `src/app.setup.ts`: `configureApp()` holds app-wide middleware and settings (request IDs,
  logging, helmet, CORS, body parser, versioning). main.ts and the tests both call it, so add
  app-wide behavior there, never only in main.ts.
- `src/config/`: env validated with Zod once at startup. No `process.env` anywhere else.
- `src/db/`: global `DatabaseModule` with the pool and the Drizzle client. Repositories inject the
  client with `@Inject(DB)`. Tables live in `src/db/schema/`, one file per module, re-exported from
  its `index.ts`, with the shared id and timestamp columns in `columns.ts`. SQL migrations in
  `apps/api/drizzle/`.
- `src/common/`: errors, validation, logging, request IDs.
- `src/modules/auth/`: a global guard closes every route. Open one with `@Public()`, limit it with
  `@Roles()`, and read the caller with `@CurrentUser()`. `src/modules/accounts/` owns `users` and
  `customers`, including first sign-in.
- `src/modules/<feature>/`: thin controller (parse, call one service method, return),
  service (business rules), repository (all DB access for the module), Zod schemas, module file.
- Modules never query another module's tables. They call that module's service.
- Integration tests in `apps/api/test/` as `*.test.ts`; unit tests next to code as `*.spec.ts`.
  Build the app with `createTestApp()` from `test/support/`. Test-only routes go in
  `test/support/probe.module.ts`; `LogCapture` asserts on real log output.
  Test apps use `FakeTokenVerifier` instead of Firebase: sign in with `tokenFor(googleAccount())`.
- `test/support/postgres.ts` starts one migrated PostgreSQL per test run, and every test app uses
  it (`inject('databaseUrl')` gives the URL). Its image must match `docker-compose.yml`.
- ESM with `nodenext`: relative imports end in `.js`. Classes injected through a constructor
  are imported as values, never `import type`: decorator metadata needs the runtime class
  (`verbatimModuleSyntax` makes `tsc` flag the mistake).

## API conventions

- Versioned paths (`/v1/...`), plural nouns. `/healthz` and `/readyz` unversioned.
- Validate every input with Zod. `z.strictObject` for bodies. Bound every string, array, number.
  Declare the schema on the parameter: `@Body({ schema })`, `@Query({ schema })`,
  `@Param({ schema })`. A parameter without a schema is not validated at all.
- Errors: RFC 9457 Problem Details (`application/problem+json`) with stable `code` and
  `requestId`. Never return stack traces, SQL or internal messages. Services throw
  `NotFoundError`, `ConflictError` or `BusinessRuleError` from `src/common/errors/` with a
  snake_case `code`; their `detail` goes to the client as is. Anything else becomes a generic 500.
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
  Open issue: Drizzle's migrator runs all pending migrations in one transaction, where
  CREATE INDEX CONCURRENTLY fails. Stop and ask before the first migration that needs it.
- Parameters only. `sql.raw` never touches user input.
- No external calls inside transactions. No read-then-write races: atomic
  `UPDATE ... WHERE ... RETURNING` or `SELECT ... FOR UPDATE`.
- Every list query has a LIMIT. No N+1 queries.

## Security

- Secrets from env vars; `.env` never committed; `.env.example` holds names and safe local values.
- Never log bodies, tokens, cookies, passwords, card data or personal data. Log IDs and outcomes.
  Log through `PinoLogger` (nestjs-pino), which carries the request id. The access log's fields
  are an allow-list in `src/common/logging/http-logger.ts`; never widen it to headers or bodies.
  Log errors as `{ err }`: `src/common/logging/serialize-error.ts` is an allow-list too, and keeps
  query parameters, row values and connection details out of the logs.
- Authorization: deny by default, ownership enforced inside the query, tokens verified (never decode-only).
- Every outbound HTTP call has a timeout, including ones a library makes for us. No fetching user-supplied URLs without an allow-list.
- Keep helmet, the CORS allow-list (`CORS_ORIGINS`) and the 100 kB JSON body limit
  (`src/app.setup.ts`).

## Definition of done

`pnpm check` passes, new behavior has tests, migration SQL was shown, and this file,
`.env.example` and docs are updated if anything they describe changed.
