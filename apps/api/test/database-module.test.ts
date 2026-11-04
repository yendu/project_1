import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { DB, PG_POOL, type Database } from '../src/db/database.js';
import { LogCapture } from './support/log-capture.js';
import { createTestApp } from './support/test-app.js';

describe('database module', () => {
  const logs = new LogCapture();
  let app: NestExpressApplication;
  let db: Database;

  beforeAll(async () => {
    // Logs made outside a request go to the root logger of the first app in the file.
    app = await createTestApp({ env: { LOG_LEVEL: 'info' }, logDestination: logs });
    db = app.get<Database>(DB);
  });

  afterAll(async () => {
    await app.close();
  });

  it('queries PostgreSQL through the Drizzle client', async () => {
    const result = await db.execute<{ one: number }>(sql`select 1 as one`);
    expect(result.rows).toEqual([{ one: 1 }]);
  });

  it('sets timeouts and an application name on every connection', async () => {
    const result = await db.execute(sql`
      select current_setting('statement_timeout') as statement_timeout,
             current_setting('idle_in_transaction_session_timeout') as idle_in_transaction_timeout,
             current_setting('application_name') as application_name
    `);
    expect(result.rows).toEqual([
      {
        statement_timeout: '10s',
        idle_in_transaction_timeout: '10s',
        application_name: 'food-delivery-api',
      },
    ]);
  });

  it('logs a failed idle connection instead of crashing, without the connection', async () => {
    const result = await db.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      await admin.query('select pg_terminate_backend($1)', [result.rows[0]?.pid]);
    } finally {
      await admin.end();
    }

    await vi.waitFor(() => {
      expect(logs.entries()).toContainEqual(
        expect.objectContaining({
          level: 50,
          context: 'DatabaseModule',
          msg: 'Idle database connection failed',
          // Exactly these fields: pg attaches the whole connection (host, user, cancel key).
          error: {
            type: 'DatabaseError',
            code: '57P01',
            message: 'terminating connection due to administrator command',
          },
        }),
      );
    });
  });
});

describe('database pool lifecycle', () => {
  it('closes the pool when the app shuts down', async () => {
    const app = await createTestApp();
    const pool = app.get<Pool>(PG_POOL);
    await app.get<Database>(DB).execute(sql`select 1`);

    await app.close();

    expect(pool.ended).toBe(true);
  });

  it('starts while the database is unreachable', async () => {
    const app = await createTestApp({
      env: { DATABASE_URL: 'postgres://food_delivery:food_delivery@127.0.0.1:1/food_delivery' },
    });
    expect(app.get<Pool>(PG_POOL).totalCount).toBe(0);
    await app.close();
  });
});
