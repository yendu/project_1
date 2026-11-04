import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LogCapture } from './support/log-capture.js';
import { createTestApp } from './support/test-app.js';

const SECRET = 'secret.customer@example.com';

describe('database errors', () => {
  const logs = new LogCapture();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ env: { LOG_LEVEL: 'info' }, logDestination: logs });
  });

  afterAll(async () => {
    await app.close();
  });

  function exceptionLog(requestId: string): Record<string, unknown> | undefined {
    return logs.entries().find((e) => e.requestId === requestId && e.msg === 'Unhandled exception');
  }

  it('answers a failing query with a generic 500', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/failing-query')
      .send({ value: SECRET });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      code: 'internal_error',
      detail: 'An unexpected error occurred.',
    });
    expect(response.text).not.toContain(SECRET);
    expect(response.text).not.toContain('select');
  });

  it('logs the SQL and SQLSTATE of a failing query, without its parameters', async () => {
    await request(app.getHttpServer())
      .post('/v1/probe/failing-query')
      .set('X-Request-Id', 'db-cast')
      .send({ value: SECRET });

    expect(exceptionLog('db-cast')).toMatchObject({
      level: 50,
      err: {
        type: 'DrizzleQueryError',
        query: 'select $1::int',
        cause: { type: 'DatabaseError', code: '22P02' },
      },
    });
    expect(logs.text).not.toContain(SECRET);
  });

  it('logs which constraint failed, without the row values PostgreSQL reports', async () => {
    await request(app.getHttpServer())
      .post('/v1/probe/duplicate-key')
      .set('X-Request-Id', 'db-duplicate')
      .send({ value: SECRET });

    expect(exceptionLog('db-duplicate')).toMatchObject({
      level: 50,
      err: {
        type: 'DrizzleQueryError',
        query: 'insert into probe_emails values ($1)',
        cause: {
          type: 'DatabaseError',
          code: '23505',
          table: 'probe_emails',
          constraint: 'probe_emails_pkey',
        },
      },
    });
    expect(logs.text).not.toContain(SECRET);
  });
});
