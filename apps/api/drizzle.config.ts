import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/config/env.js';

// Used by `pnpm db:generate` and `pnpm db:migrate`, which load apps/api/.env first.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  // camelCase in TypeScript, snake_case in SQL. Must match the Drizzle client in src/db/database.ts.
  casing: 'snake_case',
  dbCredentials: { url: loadEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
