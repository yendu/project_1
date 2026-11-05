import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

const dashboard = 'https://dashboard.example.com';

describe('security headers', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/healthz', '/v1/nope'])('sets helmet headers on %s', async (path) => {
    const response = await request(app.getHttpServer()).get(path);
    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': expect.any(String),
      'content-security-policy': expect.any(String),
    });
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });

  it('allows no cross-origin access when CORS_ORIGINS is empty', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').set('Origin', dashboard);
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });
});

describe('CORS allow-list', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ env: { CORS_ORIGINS: dashboard } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a listed origin and exposes the request id', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').set('Origin', dashboard);
    expect(response.headers['access-control-allow-origin']).toBe(dashboard);
    expect(response.headers['access-control-expose-headers']).toMatch(/x-request-id/i);
    expect(response.headers).not.toHaveProperty('access-control-allow-credentials');
  });

  it('ignores an origin that is not listed', async () => {
    const response = await request(app.getHttpServer())
      .get('/healthz')
      .set('Origin', 'https://evil.example.com');
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('answers a preflight for the headers our clients send', async () => {
    const response = await request(app.getHttpServer())
      .options('/v1/probe/orders')
      .set('Origin', dashboard)
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization,idempotency-key,x-request-id',
      );

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(dashboard);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    const allowedHeaders = String(response.headers['access-control-allow-headers']).toLowerCase();
    for (const header of ['content-type', 'authorization', 'idempotency-key', 'x-request-id']) {
      expect(allowedHeaders).toContain(header);
    }
  });
});

describe('body parsing', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts JSON bodies just under the 100 kB limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .send({ padding: 'x'.repeat(90 * 1024) });
    expect(response.status).toBe(201);
  });

  it('does not parse form-encoded bodies', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .type('form')
      .send('role=admin');
    expect(response.body).not.toEqual({ role: 'admin' });
  });
});
