# Phase 1b: API hardening

## Goal

Settle the HTTP behavior every module will rely on (errors, request IDs, logging, validation,
security headers, versioning) before the database and the first domain module arrive.
No database, no new endpoints for clients.

## Scope

1. **Problem Details errors.** Every error response is RFC 9457 `application/problem+json` with
   `type`, `title`, `status`, `detail`, a stable `code` and `requestId`. Validation failures add
   `errors: [{ path, message }]`. Covered cases:
   - schema validation failed: 400 `validation_failed`
   - malformed JSON: 400 `malformed_request`
   - unknown route: 404 `not_found`
   - body over the limit: 413 `payload_too_large`
   - anything unexpected: 500 `internal_error`, logged server-side with the stack, never sent
   - errors services throw on purpose: `NotFoundError` 404, `ConflictError` 409,
     `BusinessRuleError` 422, each with its own `code`

   Clients never see stack traces, parser messages or other internal text.

2. **Request IDs.** Accept an inbound `X-Request-Id` only if it matches a short safe pattern,
   otherwise generate one. Return it in the `X-Request-Id` response header, every problem body
   and every log line for that request.
3. **Logging.** nestjs-pino, JSON to stdout, one line per request: request ID, method, path
   without query string, status, duration. Logged fields are an allow-list: no headers, bodies,
   query strings or cookies. Level from `LOG_LEVEL`. Health checks are not access-logged.
4. **Validation.** A global `StandardSchemaValidationPipe`, so `@Body({ schema })` with Zod works
   in every module and failures become `validation_failed` problems.
5. **Security.** helmet defaults, CORS allow-list from `CORS_ORIGINS` (empty means no
   cross-origin access), JSON-only body parsing with a 100 kB limit.
6. **Versioning.** URI versioning with default version 1, so controllers live under `/v1/...`.
   `/healthz` stays unversioned.
7. **One app setup.** `main.ts` and the tests configure the app through the same function, so
   tests exercise what production runs.

## Out of scope

Rate limiting (429), authentication, `Idempotency-Key`, `/readyz` (phase 2), OpenAPI.

## Acceptance

- `pnpm check` passes. Every scope item has integration tests through HTTP.
- A test proves a 500 response contains no stack trace or exception message.
- A test captures real log output and proves `authorization`, `cookie`, bodies and query strings
  never appear in it.
- CLAUDE.md, `.env.example` and this brief are updated where they describe changed behavior.

## Checkpoints

1. After Problem Details and request IDs: stop and show example responses before logging.
2. Done: full report per CLAUDE.md.
