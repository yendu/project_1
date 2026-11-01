import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('X-Request-Id', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates an id when the client sends none', async () => {
    const response = await request(app.getHttpServer()).get('/healthz');
    expect(response.headers['x-request-id']).toMatch(uuid);
  });

  it('echoes a valid inbound id', async () => {
    const response = await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Request-Id', 'client-trace-42');
    expect(response.headers['x-request-id']).toBe('client-trace-42');
  });

  it('replaces an invalid inbound id', async () => {
    const response = await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Request-Id', 'not allowed!');
    expect(response.headers['x-request-id']).toMatch(uuid);
  });

  it('is set on error responses too', async () => {
    const response = await request(app.getHttpServer()).get('/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toMatch(uuid);
  });
});
