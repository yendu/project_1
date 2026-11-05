import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';

// Same image as docker-compose.yml.
const POSTGRES_IMAGE = 'postgres:18.6-alpine';
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL of the throwaway PostgreSQL that this test run uses. */
    databaseUrl: string;
  }
}

/** Vitest global setup: one migrated PostgreSQL container for the whole test run. */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  try {
    await applyMigrations(container.getConnectionUri());
  } catch (error) {
    await container.stop();
    throw error;
  }
  project.provide('databaseUrl', container.getConnectionUri());

  return async () => {
    await container.stop();
  };
}

/** The committed SQL in apps/api/drizzle, applied by the runner `pnpm db:migrate` uses. */
async function applyMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
