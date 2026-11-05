import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '../config/env.js';
import * as schema from './schema/index.js';

/** Injection token for the Drizzle client. Repositories inject it; controllers and services don't. */
export const DB = Symbol('DB');
/** Injection token for the pg pool behind `DB`. */
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;

/** Connects lazily: nothing touches the database until the first query. */
export function createPool(env: Env): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    application_name: 'food-delivery-api',
    // Fail fast instead of queueing requests behind a database that doesn't answer.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    // Enforced by PostgreSQL, so a slow query or a forgotten transaction can't hold a connection.
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 10_000,
  });
}

export function createDatabase(pool: Pool): Database {
  // casing must match drizzle.config.ts.
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}
