import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

describe('URI versioning', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves controllers under /v1 by default', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/ok');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('does not serve controllers without a version', async () => {
    const response = await request(app.getHttpServer()).get('/probe/ok');
    expect(response.status).toBe(404);
  });

  it('keeps /healthz unversioned', async () => {
    expect((await request(app.getHttpServer()).get('/healthz')).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/v1/healthz')).status).toBe(404);
  });
});
