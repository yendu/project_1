import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

const validOrder = {
  name: '  Margherita night  ',
  items: [{ menuItemId: '0190f5c4-8a7b-7cde-8f00-000000000001', quantity: 2 }],
};

describe('request validation', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function postOrder(body: unknown): request.Test {
    return request(app.getHttpServer())
      .post('/v1/probe/orders')
      .send(body as object);
  }

  it('passes the parsed body to the handler', async () => {
    const response = await postOrder(validOrder);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ...validOrder, name: 'Margherita night' });
  });

  it('rejects an invalid body with 400 validation_failed and field paths', async () => {
    const response = await postOrder({ items: [{ ...validOrder.items[0], quantity: 99 }] });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ code: 'validation_failed', status: 400 });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { path: 'name', message: expect.any(String) },
        { path: 'items.0.quantity', message: expect.any(String) },
      ]),
    );
  });

  it('rejects unknown keys in a body', async () => {
    const response = await postOrder({ ...validOrder, totalCents: 1 });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.errors)).toContain('totalCents');
  });

  it('rejects a missing body', async () => {
    const response = await request(app.getHttpServer()).post('/v1/probe/orders');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_failed');
  });

  it('does not echo submitted values', async () => {
    const response = await postOrder({ ...validOrder, items: 'secret-submitted-value' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain('secret-submitted-value');
  });

  it('validates query strings too', async () => {
    const ok = await request(app.getHttpServer()).get('/v1/probe/search');
    expect(ok.body).toEqual({ limit: 20 });

    const tooMany = await request(app.getHttpServer()).get('/v1/probe/search?limit=500');
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.errors).toEqual([{ path: 'limit', message: expect.any(String) }]);
  });
});
