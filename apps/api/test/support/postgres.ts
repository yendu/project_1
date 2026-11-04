import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

// Same image as docker-compose.yml.
const POSTGRES_IMAGE = 'postgres:18.6-alpine';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL of the throwaway PostgreSQL that this test run uses. */
    databaseUrl: string;
  }
}

/** Vitest global setup: one PostgreSQL container for the whole test run. */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  project.provide('databaseUrl', container.getConnectionUri());

  return async () => {
    await container.stop();
  };
}
