import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nest DI reads constructor parameter types from decorator metadata,
  // which Vite's Oxc transform only emits with these flags.
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // Starts PostgreSQL in Docker once per run, so `pnpm test` needs Docker running.
    globalSetup: ['test/support/postgres.ts'],
  },
});
