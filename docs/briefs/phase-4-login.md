# Phase 4: Users and Google sign-in

## Status

In progress. The plan was approved on 2026-11-06.

## Goal

Let the API know who is calling it. Every route needs sign-in unless it's marked public, and the
first sign-in creates the account.

## How it works

1. The browser signs in with Google through Firebase and gets a short-lived token.
2. It sends the token on each request as `Authorization: Bearer <token>`.
3. The API verifies the token and finds the user in the database.
4. On first sign-in the API creates the `users` and `customers` rows. Two requests at once still
   create one user.

## Decisions

- **Google only.** Firebase Auth with Google as its only sign-in method, for every role. This
  project has no real users. Other sign-in methods can be added if that changes.
- **Roles.** They live in `users`, never in Firebase. Anyone who signs in becomes a customer.
- **Staff, couriers and admins.** A later admin page adds an email and a role. That creates a
  `users` row with an empty `firebase_uid`, and the first sign-in with that email links to it.
- **First admin.** The `ADMIN_EMAIL` setting. That address becomes an admin on first sign-in.
- **Emails.** Stored in lowercase, so one address can't exist twice in different spellings.
  Only verified emails can sign in.

## Scope

1. Tables `users` and `customers` in `src/db/schema/accounts.ts`, in one migration.
2. `src/modules/auth/`: token check, a global guard that denies by default, `@Public()` and
   `@Roles()`.
3. `src/modules/accounts/`: first sign-in and `GET /v1/me`.
4. Config: required `FIREBASE_PROJECT_ID`, optional `ADMIN_EMAIL`, both in `.env.example`.
5. `firebase-admin` as a new dependency.

## Out of scope

The admin page and its endpoints, `addresses` (they need the coordinates service),
`restaurant_staff` and `couriers` (they arrive with their features), the web app, and creating the
Firebase project.

## Risks

- No web app exists yet, so nothing can get a real Google token. Tests use a fake token checker,
  and the real Firebase check is first exercised when `apps/web` exists.
- One role per Google account, so testing several roles needs several Gmail accounts.

## Acceptance

- `pnpm check` passes. Tests cover: no token and bad tokens return 401, a wrong role returns 403,
  public routes stay open, a double first sign-in creates one user, a pre-added email links on
  first sign-in, and tokens never reach the logs.
- The migration SQL is shown before it is applied.
- CLAUDE.md, `.env.example` and this brief are updated where they describe changed behavior.

## Checkpoints

1. After the migration is generated: show the SQL, wait before applying it locally.
2. Done: full report per CLAUDE.md.
